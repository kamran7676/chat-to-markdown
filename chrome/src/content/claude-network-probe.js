(function () {
  window.__ctxhop = [];
  function dbg() {
    var a = [].slice.call(arguments).map(function (x) { return typeof x === 'string' ? x : JSON.stringify(x); });
    window.__ctxhop.push(new Date().toLocaleTimeString() + ' ' + a.join(' '));
  }
  dbg('probe loaded');

  var TARGET = /\/(retry_)?completion(\?|$)/;

  var apiActive = false, apiBusy = false, apiBlockedUntil = 0, lastApiAt = 0, orgIds = null, lastPayload = null;

  function toMs(v) {
    if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
    if (typeof v === 'string') { var t = Date.parse(v); return isNaN(t) ? null : t; }
    return null;
  }
  function bucketPct(b) {
    if (!b || typeof b.utilization !== 'number') return null;
    return Math.max(0, Math.min(100, Math.round(b.utilization))); // already 0-100
  }
  async function getOrgIds() {
    if (orgIds) return orgIds;
    var r = await originalFetch('/api/organizations', { credentials: 'include' });
    if (!r.ok) throw new Error('orgs ' + r.status);
    var list = await r.json();
    orgIds = list
      .filter(function (o) { return !o.capabilities || o.capabilities.indexOf('chat') !== -1; })
      .map(function (o) { return o.uuid; });

    dbg('orgs', list.map(function (o) { return { cap: o.capabilities }; }));
    return orgIds;
  }

  function scheduleRefresh() {
    [1500, 6000].forEach(function (ms) {
      setTimeout(function () { refreshApiUsage(true); }, ms);
    });
  }

  async function refreshApiUsage(force) {
    var now = Date.now();
    if (apiBusy || now < apiBlockedUntil || (!force && now - lastApiAt < 15000)) return;
    apiBusy = true; lastApiAt = now;
    try {
      var ids = await getOrgIds();
      for (var i = 0; i < ids.length; i++) {
        var r = await originalFetch('/api/organizations/' + ids[i] + '/usage', { credentials: 'include' });
        if (!r.ok) { dbg('usage http', r.status); continue; }
        var d = await r.json();
        var s = bucketPct(d && d.five_hour);
        console.log('[ContextHop] /usage ->', s, d.seven_day && d.seven_day.utilization, new Date().toLocaleTimeString(), force ? '(forced)' : '');
        if (s === null) continue;
        apiActive = true;
        apiActive = true;
        var sr = toMs(d.five_hour.resets_at);
        if (lastPayload && lastPayload.sessionPct > s && lastPayload.sessionResetsAt && sr &&
          Math.abs(sr - lastPayload.sessionResetsAt) < 60000) return;
        lastPayload = {
          sessionPct: s,
          sessionResetsAt: toMs(d.five_hour.resets_at),
          weeklyPct: bucketPct(d.seven_day),
          weeklyResetsAt: d.seven_day ? toMs(d.seven_day.resets_at) : null
        };
        window.postMessage({ source: 'contexthop-claude-usage', payload: lastPayload }, '*');
        return;
      }
      apiActive = false; apiBlockedUntil = Date.now() + 30 * 60 * 1000;
    } catch (e) {
      console.log('[ContextHop] usage api failed', e);
      apiActive = false; apiBlockedUntil = Date.now() + 2 * 60 * 1000;
    } finally { apiBusy = false; }
  }

  window.addEventListener('message', function (e) {
    if (e.source === window && e.data && e.data.source === 'contexthop-usage-request' && lastPayload) {
      window.postMessage({ source: 'contexthop-claude-usage', payload: lastPayload }, '*');
    }
  });

  function toPct(w) {
    if (!w || typeof w.utilization !== 'number') return null;
    if (w.status && w.status !== 'within_limit') return 100;
    return Math.max(0, Math.min(100, Math.round(w.utilization * 100)));
  }

  function postUsage(messageLimit) {
    refreshApiUsage();
    if (!messageLimit) return;
    var w = messageLimit.windows;
    if (!w) { console.log('[ContextHop] message_limit has no windows:', JSON.stringify(messageLimit)); return; }
    var session = w['5h'] || w.five_hour || w.session;
    var weekly = w['7d'] || w.seven_day || w.weekly;
    var payload = {
      sessionPct: toPct(session),
      sessionResetsAt: session && session.resets_at ? session.resets_at * 1000 : null,
      weeklyPct: toPct(weekly),
      weeklyResetsAt: weekly && weekly.resets_at ? weekly.resets_at * 1000 : null
    };
    if (payload.sessionPct === null) return;
    lastPayload = payload;
    window.postMessage({ source: 'contexthop-claude-usage', payload: payload }, '*');
  }

  function scanSseChunk(chunk) {
    var lines = chunk.split(/\r?\n/);
    var eventType = null;
    var dataStr = '';
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.indexOf('event:') === 0) eventType = line.slice(6).trim();
      else if (line.indexOf('data:') === 0) dataStr += line.slice(5).trim();
    }
    if (eventType) console.log('[ContextHop] SSE event:', eventType, eventType === 'message_limit' ? dataStr : '');
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
          if (result.done) {
            console.log('[ContextHop] stream done'); scheduleRefresh(); return;
          }

          buffer += decoder.decode(result.value, { stream: true });
          var parts = buffer.split(/\r?\n\r?\n/);
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
    if (apiActive) return;
    var match = document.body.innerText.match(/reset[s]? at (\d{1,2}:\d{2}\s*[AP]M)/i);
    if (!match) return;
    var resetTimeStr = match[1];
    var resetsAt = parseTodayOrTomorrow(resetTimeStr);
    if (!resetsAt) return;
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
      console.log('[ContextHop] watching', url);
      promise.then(function (response) {
        watchStream(response);
        watchErrorBody(response);
      }).catch(function () { });
    }
    return promise;
  };
  refreshApiUsage();
  setInterval(refreshApiUsage, 60 * 1000);
})();