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
  if (!C2M || !C2M.getActiveAdapter || !C2M.support) return;

  const SUPPORT = C2M.support;
  const assetUrl = function (path) { return chrome.runtime.getURL(path); };
  const APP_ICON_IMG = assetUrl(SUPPORT.assets.appIcon);
  const COFFEE_BUTTON_IMG = assetUrl(SUPPORT.assets.coffeeButton);
  const EASYPAISA_ICON_IMG = assetUrl(SUPPORT.assets.easypaisaIcon);
  const JAZZCASH_ICON_IMG = assetUrl(SUPPORT.assets.jazzcashIcon);

  let adapter = null;

  function inject() {
    if (document.getElementById('chat-to-markdown-host')) return;

  const host = document.createElement('div');
  host.id = 'chat-to-markdown-host';
  host.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host { --c2m-purple:#7357f6; --c2m-orange:#ff6b57; --c2m-gradient:linear-gradient(120deg, var(--c2m-purple), var(--c2m-orange)); --c2m-bg:#12121a; --c2m-surface:#1b1b27; --c2m-surface-raised:#242334; --c2m-line:rgba(255,255,255,.11); --c2m-text:#f6f4ff; --c2m-muted:#a9a6ba; --c2m-s1:4px; --c2m-s2:8px; --c2m-s3:12px; --c2m-s4:16px; --c2m-s6:24px; --c2m-r-sm:8px; --c2m-r:12px; --c2m-r-lg:16px; --c2m-shadow:0 18px 48px rgba(7,6,16,.48); font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
      .c2m-wrap { position:relative; display:flex; flex-direction:column; align-items:flex-end; gap:var(--c2m-s2); color:var(--c2m-text); }
      .c2m-panel { position:absolute; right:0; bottom:calc(100% + 10px); display:flex; flex-direction:column; width:min(600px, calc(100vw - 40px)); height:min(64vh, 680px); background:var(--c2m-bg); border:1px solid var(--c2m-line); border-radius:var(--c2m-r-lg); overflow:hidden; box-shadow:var(--c2m-shadow); font-size:13px; opacity:0; transform:translateY(8px) scale(.985); visibility:hidden; pointer-events:none; transition:opacity .16s ease,transform .16s ease,visibility .16s; }
      .c2m-panel.open { opacity:1; transform:translateY(0) scale(1); visibility:visible; pointer-events:auto; }
      .c2m-head { display:flex; align-items:center; gap:var(--c2m-s2); padding:10px var(--c2m-s3); background:linear-gradient(100deg,rgba(115,87,246,.13),rgba(255,107,87,.08)),var(--c2m-surface); border-bottom:1px solid var(--c2m-line); }
      .c2m-brand { display:flex; align-items:center; gap:6px; color:var(--c2m-text); font-weight:750; font-size:12px; white-space:nowrap; letter-spacing:.01em; }
      .c2m-brand-icon { width:20px; height:20px; border-radius:6px; }
      .c2m-fname { flex:1; font-weight:600; font-size:12px; overflow:hidden;
                   text-overflow:ellipsis; white-space:nowrap; }
      .c2m-seg,.c2m-view-seg { display:flex; padding:2px; background:rgba(0,0,0,.2); border:1px solid var(--c2m-line); border-radius:var(--c2m-r-sm); }
      .c2m-seg button,.c2m-view-seg button { background:transparent; border:0; border-radius:6px; color:var(--c2m-muted); padding:5px 9px; font:650 11px/1 system-ui,sans-serif; cursor:pointer; transition:color .15s,background .15s; }
      .c2m-seg button.active,.c2m-view-seg button.active { background:var(--c2m-gradient); color:white; box-shadow:0 2px 8px rgba(115,87,246,.25); }
      .c2m-seg button:hover,.c2m-view-seg button:hover { color:var(--c2m-text); }
      .c2m-body { flex:1; min-height:0; }
      .c2m-preview-view { height:100%; }
      .c2m-panel textarea { width:100%; height:100%; box-sizing:border-box; resize:none; border:0; outline:none; background:#101018; color:#e9e7f3; font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; padding:var(--c2m-s4); }
      .c2m-foot { display:flex; gap:var(--c2m-s2); align-items:center; padding:10px var(--c2m-s3); border-top:1px solid var(--c2m-line); background:var(--c2m-surface); }
      .c2m-support { position:relative; margin-left:auto; }
      .c2m-support-popover { position:absolute; right:0; bottom:calc(100% + 10px); width:276px; padding:var(--c2m-s4); background:var(--c2m-surface); border:1px solid var(--c2m-line); border-radius:var(--c2m-r-lg); box-shadow:var(--c2m-shadow); opacity:0; transform:translateY(8px) scale(.98); visibility:hidden; pointer-events:none; transition:opacity .16s ease,transform .16s ease,visibility .16s; }
      .c2m-support-popover.open { opacity:1; transform:translateY(0) scale(1); visibility:visible; pointer-events:auto; }
      .c2m-support-head { display:flex; align-items:center; justify-content:space-between; gap:var(--c2m-s2); margin-bottom:var(--c2m-s2); }
      .c2m-support-heading { margin:0; color:var(--c2m-text); font-size:14px; font-weight:750; }
      .c2m-support-close { width:26px; height:26px; padding:0; border-radius:50%; background:transparent; border:1px solid transparent; color:var(--c2m-muted); font:18px/1 system-ui,sans-serif; cursor:pointer; }
      .c2m-support-close:hover { color:var(--c2m-text); background:rgba(255,255,255,.08); }
      .c2m-support-instruction { margin:0 0 var(--c2m-s3); color:var(--c2m-muted); font-size:12px; line-height:1.45; }
      .c2m-support-option { display:flex; flex-direction:column; gap:var(--c2m-s2); margin-top:var(--c2m-s2); padding:var(--c2m-s3); border:1px solid var(--c2m-line); border-radius:var(--c2m-r); color:var(--c2m-text); font-size:12px; background:rgba(255,255,255,.025); }
      .c2m-support-coffee { display:flex; align-self:stretch; justify-content:center; padding:var(--c2m-s2); border-radius:var(--c2m-r); background:rgba(255,255,255,.04); overflow:hidden; transition:transform .15s,filter .15s; }
      .c2m-support-coffee:hover { transform:translateY(-1px) scale(1.015); filter:brightness(1.1); }
      .c2m-support-coffee:focus-visible,.c2m-btn:focus-visible,.c2m-support-copy:focus-visible,.c2m-toggle:focus-visible,.c2m-donate-toggle:focus-visible,button:focus-visible { outline:2px solid var(--c2m-orange); outline-offset:2px; }
      .c2m-support-coffee img { display:block; width:100%; max-width:220px; height:auto; }
      .c2m-support-method { display:flex; align-items:center; gap:10px; font-size:13px; font-weight:700; }
      .c2m-support-brand-icon { width:30px; height:30px; object-fit:contain; border-radius:8px; }
      .c2m-support-jazz { border-left:3px solid #f35a4a; background:rgba(243,90,74,.07); }
      .c2m-support-easy { border-left:3px solid #00bd59; background:rgba(0,189,89,.07); }
      .c2m-support-number { display:flex; align-items:center; justify-content:space-between; gap:var(--c2m-s2); }
      .c2m-support-number span { user-select:text; color:var(--c2m-text); font:600 13px ui-monospace,SFMono-Regular,Menlo,monospace; }
      .c2m-support-copy,.c2m-btn { border:1px solid var(--c2m-line); border-radius:var(--c2m-r-sm); background:rgba(255,255,255,.05); color:var(--c2m-text); padding:7px 10px; font:650 12px system-ui,sans-serif; cursor:pointer; transition:background .15s,border-color .15s,transform .15s; }
      .c2m-support-copy:hover,.c2m-btn:hover { background:rgba(255,255,255,.11); border-color:rgba(255,255,255,.2); }
      .c2m-support-account { color:var(--c2m-muted); font-size:11px; }
      .c2m-btn.primary { background:var(--c2m-gradient); border-color:transparent; color:#fff; box-shadow:0 4px 14px rgba(115,87,246,.25); }
      .c2m-btn.primary:hover { transform:translateY(-1px); filter:brightness(1.08); }
      .c2m-btn.on { background:var(--c2m-gradient); border-color:transparent; }
      .c2m-context-action { display:flex; flex-direction:column; align-items:flex-end; gap:4px; }
      .c2m-helper { color:#9aa4b2; font-size:11px; white-space:nowrap; }
      .c2m-trigger-group { display:flex; align-items:stretch; padding:1px; background:var(--c2m-gradient); border-radius:999px; box-shadow:0 8px 24px rgba(38,25,87,.34); }
      .c2m-toggle,.c2m-donate-toggle { background:var(--c2m-surface); color:var(--c2m-text); border:0; cursor:pointer; font:650 12px system-ui,sans-serif; transition:background .15s; }
      .c2m-toggle { display:flex; align-items:center; gap:7px; border-radius:999px 0 0 999px; padding:7px 13px 7px 8px; }
      .c2m-toggle-icon { width:22px; height:22px; border-radius:7px; }
      .c2m-donate-toggle { width:34px; border-left:1px solid var(--c2m-line); border-radius:0 999px 999px 0; padding:0; font-size:14px; }
      .c2m-toggle:hover,.c2m-donate-toggle:hover { background:var(--c2m-surface-raised); }
      .c2m-toggle.pulse { animation:c2m-pulse 1.5s ease-in-out infinite; }
      .c2m-onboarding { position:absolute; right:0; bottom:46px; display:none; align-items:center; gap:var(--c2m-s2); padding:var(--c2m-s2) var(--c2m-s3); background:var(--c2m-surface); color:var(--c2m-text); border:1px solid rgba(115,87,246,.65); border-radius:var(--c2m-r); white-space:nowrap; font:12px system-ui,sans-serif; box-shadow:var(--c2m-shadow); }
      .c2m-onboarding.show { display:flex; }
      .c2m-onboarding-dismiss { background:transparent; border:0; color:#9aa4b2; cursor:pointer;
                font-size:14px; line-height:1; padding:0 2px; }
      @keyframes c2m-pulse { 0%,100% { box-shadow:0 8px 24px rgba(38,25,87,.34); } 50% { box-shadow:0 8px 24px rgba(115,87,246,.42),0 0 0 5px rgba(115,87,246,.14); } }
      .c2m-toast { position:fixed; right:20px; bottom:64px; background:var(--c2m-surface); color:var(--c2m-text); border:1px solid var(--c2m-line); padding:var(--c2m-s2) var(--c2m-s3); border-radius:var(--c2m-r); font:13px system-ui,sans-serif; opacity:0; transition:opacity .2s;
                   pointer-events:none; }
      .c2m-toast.show { opacity:1; }
      .c2m-spacer { flex:1; }
      .c2m-stats-view { height:100%; overflow:auto; padding:var(--c2m-s6); box-sizing:border-box; }
      .c2m-stat-hero { font-size:40px; font-weight:780; line-height:1; background:var(--c2m-gradient); -webkit-background-clip:text; background-clip:text; color:transparent; }
      .c2m-stat-label { color:var(--c2m-muted); font-size:11px; margin-top:6px; }
      .c2m-stat-detail { display:flex; gap:var(--c2m-s4); margin-top:var(--c2m-s4); color:var(--c2m-text); font-size:12px; }
      .c2m-stat-detail strong { display:block; font-size:17px; color:var(--c2m-text); }
      .c2m-stat-heading { margin:var(--c2m-s6) 0 var(--c2m-s2); color:var(--c2m-muted); font-size:11px; font-weight:700;
              text-transform:uppercase; }
      .c2m-site-row { display:flex; justify-content:space-between; gap:var(--c2m-s3); padding:9px 0; border-bottom:1px solid var(--c2m-line); color:var(--c2m-text); font-size:12px; }
      .c2m-site-count,.c2m-stat-empty { color:var(--c2m-muted); font-size:12px; }
      .c2m-stat-link { margin-top:var(--c2m-s6); padding:0; background:transparent; border:0; color:var(--c2m-muted);
               font:12px system-ui,sans-serif; text-decoration:underline; cursor:pointer; }
      [hidden] { display:none !important; }
    </style>
    <div class="c2m-wrap">
      <div class="c2m-panel" data-role="panel">
        <div class="c2m-head">
          <span class="c2m-brand">ContextHop</span>
          <div class="c2m-view-seg">
            <button data-view="preview" class="active">Preview</button>
            <button data-view="stats">Stats</button>
          </div>
          <span class="c2m-fname c2m-preview-only" data-role="fname"></span>
          <div class="c2m-seg c2m-preview-only">
            <button data-mode="md" class="active">MD</button>
            <button data-mode="yaml">YAML</button>
          </div>
          <button class="c2m-btn c2m-preview-only" data-role="sort" title="Reverse message order (newest first)">⇅</button>
          <button class="c2m-btn" data-role="close" title="Close">✕</button>
        </div>
        <div class="c2m-body">
          <div class="c2m-preview-view" data-role="preview-view">
            <textarea data-role="preview" readonly spellcheck="false"></textarea>
          </div>
          <div class="c2m-stats-view" data-role="stats-view" hidden></div>
        </div>
        <div class="c2m-foot">
          <div class="c2m-preview-only" data-role="preview-actions" style="display:contents">
            <button class="c2m-btn" data-role="refresh">↻ Refresh</button>
            <span class="c2m-spacer"></span>
            <div class="c2m-context-action">
              <button class="c2m-btn primary" data-role="context-pack">Copy Context Pack</button>
            </div>
            <button class="c2m-btn" data-role="copy">Copy</button>
            <button class="c2m-btn primary" data-role="save">Save</button>
          </div>
        </div>
      </div>
      <div class="c2m-onboarding" data-role="onboarding">
        <span>New in ContextHop: Copy Context Pack</span>
        <button class="c2m-onboarding-dismiss" data-role="onboarding-dismiss" title="Dismiss">✕</button>
      </div>
      <div class="c2m-support">
        <div class="c2m-support-popover" data-role="support-popover"></div>
        <div class="c2m-trigger-group">
          <button class="c2m-toggle" data-role="toggle" title="ContextHop — Continue any AI chat in a new one.">ContextHop</button>
          <button class="c2m-donate-toggle" data-role="support-toggle" title="Support ContextHop" type="button">☕</button>
        </div>
      </div>
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
  const previewView = qs('[data-role="preview-view"]');
  const statsView = qs('[data-role="stats-view"]');
  const supportToggle = qs('[data-role="support-toggle"]');
  const supportPopover = qs('[data-role="support-popover"]');
  const brand = qs('.c2m-brand');
  const brandIcon = document.createElement('img');
  brandIcon.className = 'c2m-brand-icon';
  brandIcon.setAttribute('src', APP_ICON_IMG);
  brandIcon.setAttribute('alt', '');
  brand.insertBefore(brandIcon, brand.firstChild);
  const toggleIcon = document.createElement('img');
  toggleIcon.className = 'c2m-toggle-icon';
  toggleIcon.setAttribute('src', APP_ICON_IMG);
  toggleIcon.setAttribute('alt', '');
  toggle.insertBefore(toggleIcon, toggle.firstChild);

  let capture = null;  // {meta, base, turns:[{role, element, elementClean, tools}]}
  let docs = null;     // {base, md, yaml} for the current mode/order
  let mode = 'md';
  let view = 'preview';
  let reverse = false; // false = chronological (oldest first), true = newest first
  let inlineUsage = null;

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

  function markSupportAutoShown() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ supportDialogAutoShown: true });
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

  function textElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function renderStatsSummary(container, stats) {
    container.textContent = '';
    const total = textElement('div', 'c2m-stat-hero', String(stats.totalExports));
    container.appendChild(total);
    container.appendChild(textElement('div', 'c2m-stat-label', 'Total exports'));
    const detail = textElement('div', 'c2m-stat-detail');
    [[stats.copyCount, 'Copies'], [stats.saveCount, 'Saves'],
      [stats.contextPackCopies, 'Context packs']].forEach(function (item) {
      const value = textElement('div');
      value.appendChild(textElement('strong', '', String(item[0])));
      value.appendChild(document.createTextNode(item[1]));
      detail.appendChild(value);
    });
    container.appendChild(detail);
    container.appendChild(textElement('div', 'c2m-stat-heading', 'Usage by site'));

    const siteList = textElement('div');
    const sites = Object.keys(stats.perSite).sort(function (a, b) {
      return stats.perSite[b] - stats.perSite[a] || a.localeCompare(b);
    });
    if (!sites.length) {
      const empty = textElement('div', 'c2m-stat-empty', 'No usage recorded yet.');
      siteList.appendChild(empty);
    } else {
      sites.forEach(function (site) {
        const row = textElement('div', 'c2m-site-row');
        const name = textElement('span', '', site);
        const count = textElement('span', 'c2m-site-count', String(stats.perSite[site]));
        row.appendChild(name);
        row.appendChild(count);
        siteList.appendChild(row);
      });
    }
    container.appendChild(siteList);
    container.appendChild(textElement('div', 'c2m-stat-heading',
      'Using ContextHop since ' + (stats.firstUsedDate || '-')));
    container.appendChild(textElement('div', 'c2m-stat-empty',
      'Last used: ' + (stats.lastUsedDate || '-')));
    const reset = textElement('button', 'c2m-stat-link', 'Reset stats');
    reset.type = 'button';
    reset.setAttribute('data-role', 'reset-stats');
    container.appendChild(reset);
  }

  function loadStats() {
    return C2M.stats.getStats().then(function (stats) {
      renderStatsSummary(statsView, stats);
    }).catch(function () {
      showToast('Stats unavailable');
    });
  }

  function applyView() {
    const statsActive = view === 'stats';
    previewView.hidden = statsActive;
    statsView.hidden = !statsActive;
    shadow.querySelectorAll('[data-view]').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-view') === view);
    });
    shadow.querySelectorAll('.c2m-preview-only').forEach(function (element) {
      element.hidden = statsActive;
    });
    if (statsActive) loadStats();
  }

  function appendSupportValue(container, label, value, toast, rowClass, iconSrc) {
    if (!value) return;
    const option = textElement('div', 'c2m-support-option' + (rowClass ? ' ' + rowClass : ''));
    const method = textElement('div', 'c2m-support-method');
    const icon = document.createElement('img');
    icon.className = 'c2m-support-brand-icon';
    icon.setAttribute('src', iconSrc);
    icon.setAttribute('alt', '');
    method.appendChild(icon);
    method.appendChild(textElement('span', '', label));
    option.appendChild(method);
    const number = textElement('div', 'c2m-support-number');
    number.appendChild(textElement('span', '', value));
    const button = textElement('button', 'c2m-support-copy', '⧉ Copy');
    button.type = 'button';
    button.addEventListener('click', function () {
      C2M.export.copyText(value).then(function (ok) {
        toast(ok ? 'Copied!' : 'Copy failed');
      });
    });
    number.appendChild(button);
    option.appendChild(number);
    container.appendChild(option);
    return option;
  }

  function renderSupport(container, toast) {
    container.textContent = '';
    const head = textElement('div', 'c2m-support-head');
    head.appendChild(textElement('div', 'c2m-support-heading', 'Support ContextHop'));
    const close = textElement('button', 'c2m-support-close', '×');
    close.type = 'button';
    close.title = 'Close support options';
    close.addEventListener('click', function () { container.classList.remove('open'); });
    head.appendChild(close);
    container.appendChild(head);
    container.appendChild(textElement('p', 'c2m-support-instruction',
      'Tap Buy Me a Coffee, or copy a wallet number to send support directly.'));
    const coffee = textElement('div', 'c2m-support-option');
    const link = document.createElement('a');
    link.className = 'c2m-support-coffee';
    link.setAttribute('href', SUPPORT.coffeeUrl);
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
    const coffeeImage = document.createElement('img');
    coffeeImage.setAttribute('src', COFFEE_BUTTON_IMG);
    coffeeImage.setAttribute('alt', 'Buy me a coffee');
    link.appendChild(coffeeImage);
    coffee.appendChild(link);
    coffee.appendChild(textElement('span', 'c2m-support-account', 'For international supporters'));
    container.appendChild(coffee);
    const localValues = [
      ['JazzCash IBAN', SUPPORT.jazzcashNumber, 'c2m-support-jazz', JAZZCASH_ICON_IMG],
      ['Easypaisa IBAN', SUPPORT.easypaisaNumber, 'c2m-support-easy', EASYPAISA_ICON_IMG]
    ];
    localValues.forEach(function (item) {
      const option = appendSupportValue(container, item[0], item[1], toast, item[2], item[3]);
      option.appendChild(textElement('span', 'c2m-support-account', 'Account title: ' + SUPPORT.accountTitle));
    });
  }

  function loadSupport(container, toast) {
    renderSupport(container, toast);
  }

  function formatResetIn(resetsAt) {
    if (!resetsAt) return '';
    const ms = resetsAt - Date.now();
    if (ms <= 0) return '';
    const totalMinutes = Math.round(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? (hours + 'h' + minutes + 'm') : (minutes + 'm');
  }

  function usageColor(pct) {
    // green (low) -> orange -> red (high), smooth interpolation
    const clamped = Math.max(0, Math.min(100, pct));
    if (clamped <= 50) {
      const t = clamped / 50;
      return mixHex('#22c55e', '#f59e0b', t);
    }
    const t = (clamped - 50) / 50;
    return mixHex('#f59e0b', '#ef4444', t);
  }

  function mixHex(a, b, t) {
    const ah = parseInt(a.slice(1), 16), bh = parseInt(b.slice(1), 16);
    const ar = (ah >> 16) & 255, ag = (ah >> 8) & 255, ab = ah & 255;
    const br = (bh >> 16) & 255, bg = (bh >> 8) & 255, bb = bh & 255;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  function formatResetIn(ts) {
    if (!ts) return '';
    const diffMs = ts - Date.now();
    if (diffMs <= 0) return 'soon';
    const totalMinutes = Math.round(diffMs / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return days + 'd ' + hours + 'h';
    if (hours > 0) return hours + 'h ' + minutes + 'm';
    return minutes + 'm';
  }

  function appendClaudeUsage(row) {
    if (!C2M.claudeUsage) return;
    const snapshot = C2M.claudeUsage.getSnapshot();
    row.appendChild(textElement('span', 'c2m-inline-separator', '·'));
    if (!snapshot || typeof snapshot.sessionPct !== 'number') {
      row.appendChild(textElement('span', 'c2m-inline-placeholder', 'Usage will show here once you start chatting'));
      return;
    }
    const pct = snapshot.sessionPct;
    const wrap = document.createElement('span');
    wrap.className = 'c2m-inline-claude-usage';
    wrap.appendChild(textElement('b', '', 'Session ' + pct + '%'));
    const track = document.createElement('span');
    track.className = 'c2m-usage-track';
    const fill = document.createElement('span');
    fill.className = 'c2m-usage-fill';
    fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    fill.style.background = usageColor(pct);
    track.appendChild(fill);
    wrap.appendChild(track);
    const resetIn = formatResetIn(snapshot.sessionResetsAt);
    if (resetIn) {
      wrap.appendChild(textElement('span', 'c2m-inline-reset', 'Reset in ' + resetIn));
    }
    row.appendChild(wrap);
  }

  function renderInlineUsage(stats) {
    if (!inlineUsage) return;
    const row = inlineUsage.row;
    row.textContent = '';
    const appIcon = document.createElement('img');
    appIcon.className = 'c2m-inline-icon';
    appIcon.setAttribute('src', APP_ICON_IMG);
    appIcon.setAttribute('alt', '');
    row.appendChild(appIcon);
    row.appendChild(textElement('span', 'c2m-inline-label', 'ContextHop'));
    row.appendChild(textElement('span', 'c2m-inline-separator', '·'));
    const count = stats.perSite[location.hostname] || 0;
    row.appendChild(textElement('span', '', count + (count === 1 ? ' export' : ' exports')));
    appendClaudeUsage(row);
  }

  function removeInlineUsage() {
    if (inlineUsage && inlineUsage.host.parentNode) inlineUsage.host.parentNode.removeChild(inlineUsage.host);
    inlineUsage = null;
  }

  function refreshInlineUsage() {
    if (!adapter || !adapter.getInlineUsageAnchor) return;
    let anchor;
    try {
      anchor = adapter.getInlineUsageAnchor();
    } catch (error) {
      removeInlineUsage();
      return;
    }
    if (!anchor || !anchor.parentNode || anchor === host) {
      removeInlineUsage();
      return;
    }
    if (!inlineUsage || inlineUsage.anchor !== anchor) {
      removeInlineUsage();
      const host = document.createElement('span');
      host.style.cssText = 'display:block;margin-top:4px;';
      const usageShadow = host.attachShadow({ mode: 'open' });
      usageShadow.innerHTML = '<style>:host{display:block;margin-top:4px;color:#8f96a3;font:11px/1.4 Inter,ui-sans-serif,system-ui,sans-serif;white-space:nowrap}.c2m-inline-usage{display:flex;align-items:center;gap:2px;opacity:.88}.c2m-inline-icon{width:14px;height:14px;margin-right:5px;border-radius:4px}.c2m-inline-label{font-weight:650;background:linear-gradient(90deg,#7357f6,#ff6b57);-webkit-background-clip:text;background-clip:text;color:transparent}.c2m-inline-separator{padding:0 12px;color:#777184}.c2m-inline-claude-usage{display:inline-flex;align-items:center;gap:9px;color:#a3a9b5;margin:0 2px}.c2m-inline-claude-usage b{color:#c7cbd4;font-weight:650}.c2m-usage-track{display:inline-block;width:46px;height:4px;border-radius:2px;background:#3a3d45;overflow:hidden;vertical-align:middle}.c2m-usage-fill{display:block;height:100%;background:linear-gradient(90deg,#7357f6,#ff6b57);border-radius:2px}.c2m-inline-reset{color:#777184}.c2m-inline-placeholder{color:#6f7684;font-style:italic}</style>';      const usageRow = document.createElement('span');
      usageRow.className = 'c2m-inline-usage';
      usageShadow.appendChild(usageRow);
      anchor.parentNode.insertBefore(host, anchor.nextSibling);
      inlineUsage = { anchor: anchor, host: host, row: usageRow };
    }
    C2M.stats.getStats().then(function (stats) {
      renderInlineUsage(stats);
    }).catch(function () {});
  }

  function recordUsage(action) {
    C2M.stats.recordUsage(location.hostname, action).catch(function () {});
  }

  function openPanel() {
    finishOnboarding();
    supportPopover.classList.remove('open');
    capture = captureDoc();
    if (!capture) return;
    rebuild();
    applyMode();
    panel.classList.add('open');
  }

  function closePanel() {
    panel.classList.remove('open');
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

  supportToggle.addEventListener('click', function (event) {
    event.stopPropagation();
    const open = supportPopover.classList.toggle('open');
    if (open) {
      closePanel();
      loadSupport(supportPopover, showToast);
    }
  });
  
  document.addEventListener('click', function (event) {
    const path = event.composedPath();
    if (supportPopover.classList.contains('open') && path.indexOf(supportPopover) === -1) {
      supportPopover.classList.remove('open');
    }
    if (panel.classList.contains('open') &&
        path.indexOf(panel) === -1 &&
        path.indexOf(toggle) === -1) {
      closePanel();
    }
  });

  shadow.querySelectorAll('.c2m-seg button').forEach(function (b) {
    b.addEventListener('click', function () {
      mode = b.getAttribute('data-mode');
      applyMode();
    });
  });

  shadow.querySelectorAll('[data-view]').forEach(function (button) {
    button.addEventListener('click', function () {
      view = button.getAttribute('data-view');
      applyView();
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
    if (ok) recordUsage('copy');
    showToast(ok ? 'Copied ' + mode.toUpperCase() : 'Copy failed');
  });

  qs('[data-role="context-pack"]').addEventListener('click', async function () {
    const conv = adapter.getConversation();
    if (!conv || !conv.turns.length) {
      showToast('No conversation found');
      return;
    }
    const ok = await C2M.export.copyText(C2M.contextPack.build(conv));
    if (ok) recordUsage('context-pack');
    showToast(ok ? 'Copied! Paste into a new chat.' : 'Copy failed', 3000);
  });

  qs('[data-role="save"]').addEventListener('click', function () {
    if (!docs) return;
    const name = fname.textContent || docs.base + '.md';
    C2M.export.downloadText(name, preview.value);
    recordUsage('save');
    showToast('Downloaded ' + name);
  });

  statsView.addEventListener('click', function (event) {
    if (!event.target || event.target.getAttribute('data-role') !== 'reset-stats') return;
    if (!window.confirm('Reset all ContextHop usage stats?')) return;
    C2M.stats.resetStats().then(function (stats) {
      renderStatsSummary(statsView, stats);
      showToast('Stats reset');
    }).catch(function () {
      showToast('Stats unavailable');
    });
  });

  loadSupport(supportPopover, showToast);
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get('supportDialogAutoShown', function (result) {
      if (result && result.supportDialogAutoShown) return;
      closePanel();
      supportPopover.classList.add('open');
      markSupportAutoShown();
    });
  }
  if (adapter.getInlineUsageAnchor) {
    refreshInlineUsage();
    setInterval(refreshInlineUsage, 2500);
  }
  showOnboarding();
  applyView();
  }

  function start() {
    if (document.getElementById('chat-to-markdown-host')) return true;
    adapter = C2M.getActiveAdapter();
    if (!adapter) return false;
    inject();
    return true;
  }

  if (!start()) {
    const poll = setInterval(function () {
      if (start()) clearInterval(poll);
    }, 1500);
  }
})();
