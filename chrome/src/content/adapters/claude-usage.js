/*
 * Bridges the MAIN-world claude-network-probe.js (which reads real session/
 * weekly usage out of Claude's own /completion SSE stream) into this
 * isolated content-script world via window.postMessage, so main.js can show
 * it in the inline usage row. Runs only on claude.ai; no network calls of
 * its own -- purely a listener.
 */
(function () {
  var ROOT = typeof window !== 'undefined' ? window : globalThis;
  var C2M = (ROOT.ChatToMarkdown = ROOT.ChatToMarkdown || {});

  var host = location.hostname;
  if (host !== 'claude.ai' && host.indexOf('.claude.ai') === -1) return;

  var snapshot = null;

  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    var data = event.data;
    if (!data || data.source !== 'contexthop-claude-usage' || !data.payload) return;
    snapshot = data.payload;
  }, false);

  C2M.claudeUsage = {
    getSnapshot: function () { return snapshot; }
  };
})();
