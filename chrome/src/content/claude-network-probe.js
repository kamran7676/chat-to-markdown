/*
 * Runs in the page's MAIN world (see manifest.json) so it can see claude.ai's
 * own window.fetch before any wrapping. Claude's /completion endpoint streams
 * Server-Sent Events, and near the end of that stream (after the reply text,
 * before "message_stop") it emits an event like:
 *
 *   event: message_limit
 *   data: {"type":"message_limit","message_limit":{
 *     "windows": {
 *       "5h": { "status": "within_limit", "resets_at": 1790155800, "utilization": 0.21 },
 *       "7d": { "status": "within_limit", "resets_at": 1790668800, "utilization": 0.03 }
 *     },
 *     "resolved": { "limit": { "percent": 21, "resets_at": "2026-09-23T09:30:00+00:00" } }
 *   }}
 *
 * That is Claude's real session/weekly usage -- the same data third-party
 * "usage tracker" extensions read. resets_at under "windows" is Unix
 * *seconds*. We only peek at a cloned response stream; we never touch or
 * delay the original response Claude's own UI is reading.
 */
(function () {
  var TARGET = /\/completion(\?|$)/;

  function postUsage(messageLimit) {
    if (!messageLimit || !messageLimit.windows) return;
    var session = messageLimit.windows['5h'];
    var weekly = messageLimit.windows['7d'];
    window.postMessage({
      source: 'contexthop-claude-usage',
      payload: {
        sessionPct: session && typeof session.utilization === 'number' ? Math.round(session.utilization * 100) : null,
        sessionResetsAt: session && session.resets_at ? session.resets_at * 1000 : null,
        weeklyPct: weekly && typeof weekly.utilization === 'number' ? Math.round(weekly.utilization * 100) : null,
        weeklyResetsAt: weekly && weekly.resets_at ? weekly.resets_at * 1000 : null
      }
    }, '*');
  }

  function scanSseChunk(chunk) {
    var lines = chunk.split('\n');
    var eventType = null;
    var dataStr = '';
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.indexOf('event:') === 0) eventType = line.slice(6).trim();
      else if (line.indexOf('data:') === 0) dataStr += line.slice(5).trim();
    }
    if (eventType !== 'message_limit' || !dataStr) return;
    try {
      var parsed = JSON.parse(dataStr);
      postUsage(parsed && parsed.message_limit);
    } catch (e) {
      // malformed/partial chunk -- ignore, next chunk may complete it
    }
  }

  function watchStream(response) {
    if (!response || !response.body || typeof response.body.getReader !== 'function') return;
    try {
      var reader = response.clone().body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';
      (function pump() {
        reader.read().then(function (result) {
          if (result.done) return;
          buffer += decoder.decode(result.value, { stream: true });
          var parts = buffer.split('\n\n');
          buffer = parts.pop();
          for (var i = 0; i < parts.length; i++) scanSseChunk(parts[i]);
          return pump();
        }).catch(function () { });
      })();
    } catch (e) {
      // response not cloneable / stream already locked -- fail silently
    }
  }

  function watchErrorBody(response) {
    if (!response || response.ok || typeof response.text !== 'function') return;
    try {
      response.clone().text().then(function (text) {
        if (!text) return;
        try {
          var parsed = JSON.parse(text);
          var err = parsed && parsed.error;
          var messageLimit = err && (err.message_limit || (err.details && err.details.message_limit));
          postUsage(messageLimit);
        } catch (e) {
        }
      }).catch(function () {
        scanLimitBannerFallback();
      });
    } catch (e) {
      scanLimitBannerFallback();
    }
  }

  function scanLimitBannerFallback() {
    // Claude ka banner jaisa: "Limits will reset at 2:40 PM"
    var match = document.body.innerText.match(/reset[s]? at (\d{1,2}:\d{2}\s*[AP]M)/i);
    if (!match) return;
    var resetTimeStr = match[1];
    var resetsAt = parseTodayOrTomorrow(resetTimeStr);
    if (!resetsAt) return;
    // sessionPct ka exact number nahi milega is tareeqe se, bas ye pata
    // chal jata hai ke limit exceed ho chuki hai aur kab reset hogi.
    window.postMessage({
      source: 'contexthop-claude-usage',
      payload: {
        sessionPct: 100,
        sessionResetsAt: resetsAt,
        weeklyPct: null,
        weeklyResetsAt: null
      }
    }, '*');
  }

  function parseTodayOrTomorrow(timeStr) {
    var m = /(\d{1,2}):(\d{2})\s*([AP]M)/i.exec(timeStr);
    if (!m) return null;
    var hours = parseInt(m[1], 10);
    var minutes = parseInt(m[2], 10);
    var isPM = m[3].toUpperCase() === 'PM';
    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
    var d = new Date();
    d.setHours(hours, minutes, 0, 0);
    if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
    return d.getTime();
  }

  var originalFetch = window.fetch;
  if (typeof originalFetch !== 'function') return;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var promise = originalFetch.apply(this, arguments);
    if (TARGET.test(url)) {
      promise.then(function (response) {
        watchStream(response);
        watchErrorBody(response);
      }).catch(function () { });
    }
    return promise;
  };
})();