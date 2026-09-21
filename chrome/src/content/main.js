/*
 * Floating export button + preview panel with Markdown / YAML modes and an
 * ascending/descending message-order toggle (shadow DOM so site styles can't
 * touch it, and it can't touch site styles). Attached to <html> so SPA
 * re-renders inside body don't remove it.
 *
 * Detection retries: adapters keyed to hostnames match at document_idle, but
 * DOM-signature adapters (Open WebUI family, e.g. z.ai) can only match once
 * the SPA actually mounts a conversation — so start() is re-run on a short
 * interval until it wins.
 */
(function () {
  const C2M = window.ChatToMarkdown;
  if (!C2M || !C2M.getActiveAdapter) return;

  let adapter = null;

  function inject() {
    if (document.getElementById('chat-to-markdown-host')) return;

  const host = document.createElement('div');
  host.id = 'chat-to-markdown-host';
  host.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      .c2m-wrap { display:flex; flex-direction:column; align-items:flex-end; gap:8px; }
      .c2m-panel { display:none; flex-direction:column; width:min(560px, calc(100vw - 40px));
                   height:min(60vh, 640px); background:#151a23; border:1px solid #3a4150;
                   border-radius:12px; overflow:hidden; box-shadow:0 12px 40px rgba(0,0,0,.5);
                   font:13px system-ui,sans-serif; color:#e8eaed; }
      .c2m-panel.open { display:flex; }
      .c2m-head { display:flex; align-items:center; gap:8px; padding:8px 12px;
                  background:#1f2430; border-bottom:1px solid #3a4150; }
      .c2m-fname { flex:1; font-weight:600; font-size:12px; overflow:hidden;
                   text-overflow:ellipsis; white-space:nowrap; }
      .c2m-seg { display:flex; border:1px solid #3a4150; border-radius:8px; overflow:hidden; }
      .c2m-seg button { background:#151a23; border:0; color:#9aa4b2; padding:4px 10px;
                        font:600 11px system-ui,sans-serif; cursor:pointer; }
      .c2m-seg button.active { background:#2c3342; color:#e8eaed; }
      .c2m-body { flex:1; min-height:0; }
      .c2m-panel textarea { width:100%; height:100%; box-sizing:border-box; resize:none;
                            border:0; outline:none; background:#0e1218; color:#dbe1ea;
                            font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
                            padding:10px 12px; }
      .c2m-foot { display:flex; gap:8px; align-items:center; padding:8px 12px;
                  border-top:1px solid #3a4150; background:#1f2430; }
      .c2m-btn { background:#2c3342; border:1px solid #3a4150; color:#e8eaed; border-radius:8px;
                 padding:6px 12px; font:600 12px system-ui,sans-serif; cursor:pointer; }
      .c2m-btn:hover { background:#3a4150; }
      .c2m-btn.primary { background:#4f6ef7; border-color:#4f6ef7; }
      .c2m-btn.primary:hover { background:#3d5cf0; }
      .c2m-btn.on { background:#4f6ef7; border-color:#4f6ef7; }
      .c2m-context-action { display:flex; flex-direction:column; align-items:flex-end; gap:4px; }
      .c2m-helper { color:#9aa4b2; font-size:11px; white-space:nowrap; }
      .c2m-toggle { background:#1f2430; color:#e8eaed; border:1px solid #3a4150;
                    border-radius:999px; padding:7px 14px; font:600 12px system-ui,sans-serif;
                    cursor:pointer; box-shadow:0 4px 16px rgba(0,0,0,.3); }
      .c2m-toggle:hover { background:#2c3342; }
      .c2m-toggle.pulse { animation:c2m-pulse 1.5s ease-in-out infinite; }
      .c2m-onboarding { position:absolute; right:0; bottom:42px; display:none; align-items:center;
            gap:8px; padding:8px 10px; background:#1f2430; color:#e8eaed;
            border:1px solid #4f6ef7; border-radius:8px; white-space:nowrap;
            font:12px system-ui,sans-serif; box-shadow:0 6px 20px rgba(0,0,0,.35); }
      .c2m-onboarding.show { display:flex; }
      .c2m-onboarding-dismiss { background:transparent; border:0; color:#9aa4b2; cursor:pointer;
                font-size:14px; line-height:1; padding:0 2px; }
      @keyframes c2m-pulse { 0%,100% { box-shadow:0 4px 16px rgba(0,0,0,.3); }
                 50% { box-shadow:0 4px 16px rgba(79,110,247,.3), 0 0 0 6px rgba(79,110,247,.15); } }
      .c2m-toast { position:fixed; right:20px; bottom:64px; background:#1f2430; color:#e8eaed;
                   border:1px solid #3a4150; padding:8px 12px; border-radius:8px;
                   font:13px system-ui,sans-serif; opacity:0; transition:opacity .2s;
                   pointer-events:none; }
      .c2m-toast.show { opacity:1; }
      .c2m-spacer { flex:1; }
    </style>
    <div class="c2m-wrap">
      <div class="c2m-panel" data-role="panel">
        <div class="c2m-head">
          <span class="c2m-fname" data-role="fname"></span>
          <div class="c2m-seg">
            <button data-mode="md" class="active">MD</button>
            <button data-mode="yaml">YAML</button>
          </div>
          <button class="c2m-btn" data-role="sort" title="Reverse message order (newest first)">⇅</button>
          <button class="c2m-btn" data-role="close" title="Close">✕</button>
        </div>
        <div class="c2m-body"><textarea data-role="preview" readonly spellcheck="false"></textarea></div>
        <div class="c2m-foot">
          <button class="c2m-btn" data-role="refresh">↻ Refresh</button>
          <span class="c2m-spacer"></span>
          <div class="c2m-context-action">
            <button class="c2m-btn primary" data-role="context-pack">Copy Context Pack</button>
            <span class="c2m-helper">Paste in a new chat to continue</span>
          </div>
          <button class="c2m-btn" data-role="copy">Copy</button>
          <button class="c2m-btn primary" data-role="save">Save</button>
        </div>
      </div>
      <div class="c2m-onboarding" data-role="onboarding">
        <span>New: Copy Context Pack</span>
        <button class="c2m-onboarding-dismiss" data-role="onboarding-dismiss" title="Dismiss">✕</button>
      </div>
      <button class="c2m-toggle" data-role="toggle" title="Preview this conversation as Markdown or YAML">MD ▾</button>
    </div>
    <div class="c2m-toast" data-role="toast"></div>`;
  document.documentElement.appendChild(host);

  const qs = function (sel) { return shadow.querySelector(sel); };
  const panel = qs('[data-role="panel"]');
  const fname = qs('[data-role="fname"]');
  const preview = qs('[data-role="preview"]');
  const toggle = qs('[data-role="toggle"]');
  const toast = qs('[data-role="toast"]');
  const onboarding = qs('[data-role="onboarding"]');

  let capture = null;  // {meta, base, turns:[{role, element, elementClean, tools}]}
  let docs = null;     // {base, md, yaml} for the current mode/order
  let mode = 'md';
  let reverse = false; // false = chronological (oldest first), true = newest first

  function showToast(msg, duration) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(function () { toast.classList.remove('show'); }, duration || 1800);
  }

  function finishOnboarding() {
    onboarding.classList.remove('show');
    toggle.classList.remove('pulse');
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ contextPackOnboardingSeen: true });
    }
  }

  function showOnboarding() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      onboarding.classList.add('show');
      toggle.classList.add('pulse');
      return;
    }
    chrome.storage.local.get('contextPackOnboardingSeen', function (result) {
      if (result && result.contextPackOnboardingSeen) return;
      onboarding.classList.add('show');
      toggle.classList.add('pulse');
    });
  }

  function captureDoc() {
    const conv = adapter.getConversation();
    if (!conv || !conv.turns.length) {
      showToast('No conversation found');
      return null;
    }
    const turns = conv.turns.map(function (t) {
      if (adapter.prepareTurn) {
        const p = adapter.prepareTurn(t.element);
        return {
          role: t.role,
          element: p.element,
          elementClean: p.elementClean || p.element,
          tools: p.tools || []
        };
      }
      return { role: t.role, element: t.element, elementClean: t.element, tools: [] };
    });
    const meta = {
      title: conv.title,
      source: location.hostname,
      url: location.href,
      date: new Date().toISOString().slice(0, 10)
    };
    const base = C2M.export.buildFilename(conv.title).replace(/\.md$/, '');
    return { meta: meta, base: base, turns: turns };
  }

  function buildFor(m) {
    let turns = capture.turns.slice();
    if (reverse) turns.reverse();
    return m === 'md'
      ? C2M.export.buildDocument(capture.meta, turns.map(function (p) {
          return { role: p.role, element: p.element };
        }))
      : C2M.export.buildYaml(capture.meta, turns.map(function (p) {
          return { role: p.role, element: p.elementClean, tools: p.tools };
        }));
  }

  function rebuild() {
    docs = { base: capture.base, md: buildFor('md'), yaml: buildFor('yaml') };
  }

  function applyMode() {
    if (!docs) return;
    const filename = docs.base + (mode === 'md' ? '.md' : '.yaml');
    fname.textContent = filename;
    fname.title = filename;
    preview.value = docs[mode];
    shadow.querySelectorAll('.c2m-seg button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-mode') === mode);
    });
  }

  function openPanel() {
    finishOnboarding();
    capture = captureDoc();
    if (!capture) return;
    rebuild();
    applyMode();
    panel.classList.add('open');
    toggle.textContent = 'MD ▴';
  }

  function closePanel() {
    panel.classList.remove('open');
    toggle.textContent = 'MD ▾';
  }

  toggle.addEventListener('click', function (e) {
    e.stopPropagation();
    panel.classList.contains('open') ? closePanel() : openPanel();
  });
  qs('[data-role="onboarding-dismiss"]').addEventListener('click', function (e) {
    e.stopPropagation();
    finishOnboarding();
  });
  qs('[data-role="close"]').addEventListener('click', closePanel);

  shadow.querySelectorAll('.c2m-seg button').forEach(function (b) {
    b.addEventListener('click', function () {
      mode = b.getAttribute('data-mode');
      applyMode();
    });
  });

  qs('[data-role="sort"]').addEventListener('click', function () {
    if (!capture) return;
    reverse = !reverse;
    this.classList.toggle('on', reverse);
    const scroll = preview.scrollTop;
    rebuild();
    applyMode();
    preview.scrollTop = preview.scrollHeight - preview.clientHeight - scroll;
    showToast(reverse ? 'Newest first' : 'Oldest first');
  });

  qs('[data-role="refresh"]').addEventListener('click', function () {
    const scroll = preview.scrollTop;
    capture = captureDoc();
    if (capture) {
      rebuild();
      applyMode();
      preview.scrollTop = Math.max(0, preview.scrollHeight - preview.clientHeight - scroll);
      showToast('Preview refreshed');
    }
  });

  qs('[data-role="copy"]').addEventListener('click', async function () {
    if (!docs) return;
    const ok = await C2M.export.copyText(preview.value);
    showToast(ok ? 'Copied ' + mode.toUpperCase() : 'Copy failed');
  });

  qs('[data-role="context-pack"]').addEventListener('click', async function () {
    const conv = adapter.getConversation();
    if (!conv || !conv.turns.length) {
      showToast('No conversation found');
      return;
    }
    const ok = await C2M.export.copyText(C2M.contextPack.build(conv));
    showToast(ok ? 'Copied! Paste into a new chat.' : 'Copy failed', 3000);
  });

  qs('[data-role="save"]').addEventListener('click', function () {
    if (!docs) return;
    const name = fname.textContent || docs.base + '.md';
    C2M.export.downloadText(name, preview.value);
    showToast('Downloaded ' + name);
  });
  }

  function start() {
    if (document.getElementById('chat-to-markdown-host')) return true;
    adapter = C2M.getActiveAdapter();
    if (!adapter) return false;
    inject();
    showOnboarding();
    return true;
  }

  if (!start()) {
    const poll = setInterval(function () {
      if (start()) clearInterval(poll);
    }, 1500);
  }
})();
