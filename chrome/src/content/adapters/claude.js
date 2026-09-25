/*
 * Site adapter: Claude (claude.ai, incl. /share/ pages).
 * Selectors verified against a live /share/ page 2026-09-07:
 *   user      — [data-testid="user-message"]
 *   assistant — content node under [class*="msg-assistant-pb"] inside its
 *               message-row; rows carrying neither are aria-only headers
 *               ("You said:" / "Claude responded:") and are skipped.
 * The sr-only header text is additionally stripped converter-side.
 */
(function () {
  const ROOT = typeof window !== 'undefined' ? window : globalThis;
  const C2M = (ROOT.ChatToMarkdown = ROOT.ChatToMarkdown || {});

  const HOSTS = ['claude.ai'];

  function getInlineUsageAnchor() {
    const composer = document.querySelector('[contenteditable="true"]');
    if (!composer) return null;
    return composer.closest('fieldset[data-perf-region="composer"]') || composer;
  }

  function isCurrentSite() {
    const h = location.hostname;
    return HOSTS.some(function (x) { return h === x || h.endsWith('.' + x); });
  }

  function getTurns() {
    const out = [];
    document.querySelectorAll('[class*="message-row"]').forEach(function (row) {
      const userEl = row.querySelector('[data-testid="user-message"]');
      if (userEl) {
        out.push({ role: 'user', element: userEl });
        return;
      }
      const asstEl = row.querySelector('[class*="msg-assistant-pb"]');
      if (asstEl) {
        out.push({ role: 'assistant', element: asstEl });
      }
    });
    return out;
  }

  function sleep(milliseconds) {
    return new Promise(function (resolve) { setTimeout(resolve, milliseconds); });
  }

  function getConversationScroller() {
    const firstRow = document.querySelector('[class*="message-row"]');
    for (let node = firstRow; node && node !== document.body; node = node.parentElement) {
      const style = window.getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 100) {
        return node;
      }
    }
    return document.scrollingElement || document.documentElement;
  }

  function turnKey(turn) {
    const row = turn.element.closest && turn.element.closest('[class*="message-row"]');
    if (!row) return null;
    return row.getAttribute('data-message-id') || row.getAttribute('data-testid') || null;
  }

  // Claude virtualizes older turns in long conversations. Walk from the top
  // down, cloning each rendered turn before the site can recycle its DOM node.
  async function collectFullConversation(onProgress) {
    const scroller = getConversationScroller();
    if (!scroller || !scroller.scrollHeight) return getConversation();

    const originalTop = scroller.scrollTop;
    const seenNodes = new WeakSet();
    const seenKeys = new Set();
    const turns = [];
    const collectVisibleTurns = function () {
      getTurns().forEach(function (turn) {
        const key = turnKey(turn);
        if ((key && seenKeys.has(key)) || (!key && seenNodes.has(turn.element))) return;
        if (key) seenKeys.add(key);
        seenNodes.add(turn.element);
        turns.push({ role: turn.role, element: turn.element.cloneNode(true) });
      });
    };

    try {
      scroller.scrollTop = 0;
      await sleep(250);
      let stableAtBottom = 0;
      for (let step = 0; step < 160 && stableAtBottom < 3; step += 1) {
        collectVisibleTurns();
        const maximum = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
        const percent = maximum ? Math.min(99, Math.round((scroller.scrollTop / maximum) * 100)) : 100;
        if (onProgress) onProgress(percent);
        if (scroller.scrollTop >= maximum - 2) {
          stableAtBottom += 1;
          await sleep(250);
          continue;
        }
        stableAtBottom = 0;
        scroller.scrollTop = Math.min(maximum, scroller.scrollTop + Math.max(320, Math.floor(scroller.clientHeight * 0.8)));
        await sleep(180);
      }
      collectVisibleTurns();
      if (onProgress) onProgress(100);
      return turns.length ? { title: getTitle(), turns: turns } : getConversation();
    } finally {
      scroller.scrollTop = originalTop;
    }
  }

  function getTitle() {
    const el = document.querySelector('[data-testid="conversation-title"]');
    if (el && el.textContent.trim()) return el.textContent.trim();
    const t = (document.title || '').replace(/\s*[-–|]\s*Claude\s*$/i, '').trim();
    if (t && t.toLowerCase() !== 'claude') return t;
    const firstUser = document.querySelector('[data-testid="user-message"]');
    return firstUser
      ? firstUser.textContent.trim().replace(/\s+/g, ' ').slice(0, 80)
      : 'Claude conversation';
  }

  function getConversation() {
    const turns = getTurns();
    if (!turns.length) return null;
    return { title: getTitle(), turns: turns };
  }

  C2M.adapters = C2M.adapters || [];
  C2M.adapters.push({
    id: 'claude',
    label: 'Claude',
    isCurrentSite: isCurrentSite,
    getConversation: getConversation,
    collectFullConversation: collectFullConversation,
    getInlineUsageAnchor: getInlineUsageAnchor,
    prepareTurn: function (el) { return C2M.toolCalls.prepareTurn(el); }
  });
})();
