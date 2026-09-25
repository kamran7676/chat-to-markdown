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

  const MD_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor" width="13" height="13"><path d="M256 0a256 256 0 1 0 0 512 256 256 0 1 0 0-512zM244.7 387.3l-104-104c-4.6-4.6-5.9-11.5-3.5-17.4s8.3-9.9 14.8-9.9l56 0 0-96c0-17.7 14.3-32 32-32l32 0c17.7 0 32 14.3 32 32l0 96 56 0c6.5 0 12.3 3.9 14.8 9.9s1.1 12.9-3.5 17.4l-104 104c-6.2 6.2-16.4 6.2-22.6 0z"/></svg>';
  const YAML_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor" width="13" height="13"><path d="M0 64C0 28.7 28.7 0 64 0L213.5 0c17 0 33.3 6.7 45.3 18.7L365.3 125.3c12 12 18.7 28.3 18.7 45.3L384 448c0 35.3-28.7 64-64 64L64 512c-35.3 0-64-28.7-64-64L0 64zm208-5.5l0 93.5c0 13.3 10.7 24 24 24L325.5 176 208 58.5zM88 64C74.7 64 64 74.7 64 88s10.7 24 24 24l48 0c13.3 0 24-10.7 24-24s-10.7-24-24-24L88 64zm0 96c-13.3 0-24 10.7-24 24s10.7 24 24 24l48 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-48 0zm70.3 160c-11.3 0-21.9 5.1-28.9 13.9L69.3 409c-8.3 10.3-6.6 25.5 3.7 33.7s25.5 6.6 33.7-3.8l47.1-58.8 15.2 50.7c3 10.2 12.4 17.1 23 17.1l104 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-86.1 0-16.1-53.6c-4.7-15.7-19.1-26.4-35.5-26.4z"/></svg>';

  let adapter = null;

  function inject() {
    if (document.getElementById('chat-to-markdown-host')) return;

    const host = document.createElement('div');
    host.id = 'chat-to-markdown-host';
    host.style.cssText = 'display:block;width:100%;box-sizing:border-box;margin:0 0 8px;position:relative;z-index:5;isolation:isolate;';

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
    <style>
  :host {
    --c2m-purple:#7357f6;
    --c2m-orange:#ff6b57;
    --c2m-gradient:linear-gradient(120deg, var(--c2m-purple), var(--c2m-orange));
    --c2m-bg:#12121a;
    --c2m-surface:#1b1b27;
    --c2m-surface-raised:#242334;
    --c2m-line:rgba(255,255,255,.11);
    --c2m-text:#f6f4ff;
    --c2m-muted:#a9a6ba;
    --c2m-s1:4px;
    --c2m-s2:8px;
    --c2m-s3:12px;
    --c2m-s4:16px;
    --c2m-s6:24px;
    --c2m-r-sm:8px;
    --c2m-r:12px;
    --c2m-r-lg:16px;
    --c2m-shadow:0 18px 48px rgba(7,6,16,.48);
    font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  }
  .c2m-wrap {
    position:relative;
    display:flex;
    flex-direction:column;
    align-items:flex-end;
    gap:var(--c2m-s2);
    color:var(--c2m-text);
  }
  .c2m-panel {
    position:absolute;
    right:0;
    bottom:calc(100% + 10px);
    display:flex;
    flex-direction:column;
    width:min(600px, calc(100vw - 40px));
    height:min(64vh, 680px);
    background:var(--c2m-bg);
    border:1px solid var(--c2m-line);
    border-radius:var(--c2m-r-lg);
    overflow:hidden;
    box-shadow:var(--c2m-shadow);
    font-size:13px;
    opacity:0;
    transform:translateY(8px) scale(.985);
    visibility:hidden;
    pointer-events:none;
    transition:opacity .16s ease,transform .16s ease,visibility .16s;
  }
  .c2m-panel.open {
    opacity:1;
    transform:translateY(0) scale(1);
    visibility:visible;
    pointer-events:auto;
  }
  .c2m-head {
    display:flex;
    align-items:center;
    gap:var(--c2m-s2);
    padding:10px var(--c2m-s3);
    background:linear-gradient(100deg,rgba(115,87,246,.13),rgba(255,107,87,.08)),var(--c2m-surface);
    border-bottom:1px solid var(--c2m-line);
  }
  .c2m-brand {
    display:flex;
    align-items:center;
    gap:6px;
    color:var(--c2m-text);
    font-weight:750;
    font-size:12px;
    white-space:nowrap;
    letter-spacing:.01em;
  }
  .c2m-brand-icon {
    width:20px;
    height:20px;
    border-radius:6px;
  }
  .c2m-fname {
    flex:1;
    font-weight:600;
    font-size:12px;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
  }
  .c2m-seg,.c2m-view-seg {
    display:flex;
    padding:2px;
    background:rgba(0,0,0,.2);
    border:1px solid var(--c2m-line);
    border-radius:var(--c2m-r-sm);
  }
  .c2m-seg button,.c2m-view-seg button {
    background:transparent;
    border:0;
    border-radius:6px;
    color:var(--c2m-muted);
    padding:5px 9px;
    font:650 11px/1 system-ui,sans-serif;
    cursor:pointer;
    transition:color .15s,background .15s;
  }
  .c2m-seg button.active,.c2m-view-seg button.active {
    background:var(--c2m-gradient);
    color:white;
    box-shadow:0 2px 8px rgba(115,87,246,.25);
  }
  .c2m-seg button:hover,.c2m-view-seg button:hover {
    color:var(--c2m-text);
  }
  .c2m-body {
    flex:1;
    min-height:0;
  }
  .c2m-preview-view {
    height:100%;
  }
  .c2m-panel textarea {
    width:100%;
    height:100%;
    box-sizing:border-box;
    resize:none;
    border:0;
    outline:none;
    background:#101018;
    color:#e9e7f3;
    font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
    padding:var(--c2m-s4);
  }
  .c2m-foot {
    display:flex;
    gap:var(--c2m-s2);
    align-items:center;
    padding:10px var(--c2m-s3);
    border-top:1px solid var(--c2m-line);
    background:var(--c2m-surface);
  }
  .c2m-support {
    position:relative;
    margin-left:auto;
  }
  .c2m-support-popover {
    position:absolute;
    right:0;
    bottom:calc(100% + 10px);
    width:276px;
    padding:var(--c2m-s4);
    background:var(--c2m-surface);
    border:1px solid var(--c2m-line);
    border-radius:var(--c2m-r-lg);
    box-shadow:var(--c2m-shadow);
    opacity:0;
    transform:translateY(8px) scale(.98);
    visibility:hidden;
    pointer-events:none;
    transition:opacity .16s ease,transform .16s ease,visibility .16s;
  }
  .c2m-support-popover.open {
    opacity:1;
    transform:translateY(0) scale(1);
    visibility:visible;
    pointer-events:auto;
  }
  .c2m-support-head {
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:var(--c2m-s2);
    margin-bottom:var(--c2m-s2);
  }
  .c2m-support-heading {
    margin:0;
    color:var(--c2m-text);
    font-size:14px;
    font-weight:750;
  }
  .c2m-support-close {
    width:26px;
    height:26px;
    padding:0;
    border-radius:50%;
    background:transparent;
    border:1px solid transparent;
    color:var(--c2m-muted);
    font:18px/1 system-ui,sans-serif;
    cursor:pointer;
  }
  .c2m-support-close:hover {
    color:var(--c2m-text);
    background:rgba(255,255,255,.08);
  }
  .c2m-support-instruction {
    margin:0 0 var(--c2m-s3);
    color:var(--c2m-muted);
    font-size:12px;
    line-height:1.45;
  }
  .c2m-support-option {
    display:flex;
    flex-direction:column;
    gap:var(--c2m-s2);
    margin-top:var(--c2m-s2);
    padding:var(--c2m-s3);
    border:1px solid var(--c2m-line);
    border-radius:var(--c2m-r);
    color:var(--c2m-text);
    font-size:12px;
    background:rgba(255,255,255,.025);
  }
  .c2m-support-coffee {
    display:flex;
    align-self:stretch;
    justify-content:center;
    padding:var(--c2m-s2);
    border-radius:var(--c2m-r);
    background:rgba(255,255,255,.04);
    overflow:hidden;
    transition:transform .15s,filter .15s;
  }
  .c2m-support-coffee:hover {
    transform:translateY(-1px) scale(1.015);
    filter:brightness(1.1);
  }
  .c2m-support-coffee:focus-visible,.c2m-btn:focus-visible,.c2m-support-copy:focus-visible,.c2m-toggle:focus-visible,.c2m-donate-toggle:focus-visible,button:focus-visible {
    outline:2px solid var(--c2m-orange);
    outline-offset:2px;
  }
  .c2m-support-coffee img {
    display:block;
    width:100%;
    max-width:220px;
    height:auto;
  }
  .c2m-support-method {
    display:flex;
    align-items:center;
    gap:10px;
    font-size:13px;
    font-weight:700;
  }
  .c2m-support-brand-icon {
    width:30px;
    height:30px;
    object-fit:contain;
    border-radius:8px;
  }
  .c2m-support-jazz {
    border-left:3px solid #f35a4a;
    background:rgba(243,90,74,.07);
  }
  .c2m-support-easy {
    border-left:3px solid #00bd59;
    background:rgba(0,189,89,.07);
  }
  .c2m-support-number {
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:var(--c2m-s2);
  }
  .c2m-support-number span {
    user-select:text;
    color:var(--c2m-text);
    font:600 13px ui-monospace,SFMono-Regular,Menlo,monospace;
  }
  .c2m-support-copy,.c2m-btn {
    border:1px solid var(--c2m-line);
    border-radius:var(--c2m-r-sm);
    background:rgba(255,255,255,.05);
    color:var(--c2m-text);
    padding:7px 10px;
    font:650 12px system-ui,sans-serif;
    cursor:pointer;
    transition:background .15s,border-color .15s,transform .15s;
  }
  .c2m-support-copy:hover,.c2m-btn:hover {
    background:rgba(255,255,255,.11);
    border-color:rgba(255,255,255,.2);
  }
  .c2m-support-account {
    color:var(--c2m-muted);
    font-size:11px;
  }
  .c2m-btn.primary {
    background:var(--c2m-gradient);
    border-color:transparent;
    color:#fff;
    box-shadow:0 4px 14px rgba(115,87,246,.25);
  }
  .c2m-btn.primary:hover {
    transform:translateY(-1px);
    filter:brightness(1.08);
  }
  .c2m-btn.on {
    background:var(--c2m-gradient);
    border-color:transparent;
  }
  .c2m-context-action {
    display:flex;
    flex-direction:column;
    align-items:flex-end;
    gap:4px;
  }
  .c2m-helper {
    color:#9aa4b2;
    font-size:11px;
    white-space:nowrap;
  }
  .c2m-trigger-group {
    display:none;
    align-items:center;
    gap:6px;
    padding:2px;
    background:rgba(15,15,22,.92);
    border:1px solid rgba(255,255,255,.08);
    border-radius:999px;
    box-shadow:0 12px 30px rgba(7,6,16,.45);
  }
  /* Trigger group hidden: opening the panel/support popover now happens
  from the "Export" / "Support" buttons in the inline row above the
  composer instead, so we don't show the same two actions twice. */
  .c2m-toggle,.c2m-donate-toggle {
    background:var(--c2m-surface);
    color:var(--c2m-text);
    border:0;
    cursor:pointer;
    font:650 12px system-ui,sans-serif;
    transition:background .15s, transform .15s, box-shadow .15s;
  }
  .c2m-toggle {
    position:relative;
    display:flex;
    align-items:center;
    justify-content:center;
    width:42px;
    height:42px;
    border-radius:999px;
    padding:0;
    overflow:visible;
    background:linear-gradient(135deg, rgba(115,87,246,.18), rgba(255,107,87,.18));
  }
  .c2m-toggle-label {
    display:none;
  }
  .c2m-toggle-badge {
    position:absolute;
    right:-2px;
    bottom:-2px;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    min-width:16px;
    height:16px;
    padding:0 4px;
    border-radius:999px;
    background:linear-gradient(120deg, rgba(115,87,246,.95), rgba(255,107,87,.95));
    color:#fff;
    font-size:9px;
    font-weight:800;
    line-height:1;
    border:2px solid rgba(15,15,22,.9);
    box-shadow:0 4px 10px rgba(115,87,246,.45);
  }
  .c2m-toggle-icon {
    width:22px;
    height:22px;
    border-radius:7px;
    flex-shrink:0;
  }
  .c2m-donate-toggle {
    width:30px;
    height:30px;
    min-width:30px;
    border-radius:999px;
    padding:0;
    font-size:14px;
    display:flex;
    align-items:center;
    justify-content:center;
  }
  .c2m-toggle:hover,.c2m-donate-toggle:hover {
    transform:translateY(-1px);
  }
  .c2m-toggle.pulse {
    animation:c2m-pulse 1.5s ease-in-out infinite;
  }
  .c2m-onboarding {
    position:absolute;
    right:0;
    bottom:-34px;
    display:none;
    align-items:center;
    gap:var(--c2m-s2);
    padding:var(--c2m-s2) var(--c2m-s3);
    background:var(--c2m-surface);
    color:var(--c2m-text);
    border:1px solid rgba(115,87,246,.65);
    border-radius:var(--c2m-r);
    white-space:nowrap;
    font:12px system-ui,sans-serif;
    box-shadow:var(--c2m-shadow);
  }
  .c2m-onboarding.show {
    display:flex;
  }
  .c2m-onboarding-dismiss {
    background:transparent;
    border:0;
    color:#9aa4b2;
    cursor:pointer;
    font-size:14px;
    line-height:1;
    padding:0 2px;
  }
  @keyframes c2m-pulse {
    0%,100%
    {
      box-shadow:0 8px 24px rgba(38,25,87,.34);
    }
    50%
    {
      box-shadow:0 8px 24px rgba(115,87,246,.42),0 0 0 5px rgba(115,87,246,.14);
    }
  }
  .c2m-toast {
    position:fixed;
    right:20px;
    bottom:64px;
    background:var(--c2m-surface);
    color:var(--c2m-text);
    border:1px solid var(--c2m-line);
    padding:var(--c2m-s2) var(--c2m-s3);
    border-radius:var(--c2m-r);
    font:13px system-ui,sans-serif;
    opacity:0;
    transition:opacity .2s;
    pointer-events:none;
  }
  .c2m-toast.show {
    opacity:1;
  }
  .c2m-spacer {
    flex:1;
  }
  .c2m-stats-view {
    height:100%;
    overflow:auto;
    padding:var(--c2m-s6);
    box-sizing:border-box;
  }
  .c2m-stat-hero {
    font-size:40px;
    font-weight:780;
    line-height:1;
    background:var(--c2m-gradient);
    -webkit-background-clip:text;
    background-clip:text;
    color:transparent;
  }
  .c2m-stat-label {
    color:var(--c2m-muted);
    font-size:11px;
    margin-top:6px;
  }
  .c2m-stat-detail {
    display:flex;
    gap:var(--c2m-s4);
    margin-top:var(--c2m-s4);
    color:var(--c2m-text);
    font-size:12px;
  }
  .c2m-stat-detail strong {
    display:block;
    font-size:17px;
    color:var(--c2m-text);
  }
  .c2m-stat-heading {
    margin:var(--c2m-s6) 0 var(--c2m-s2);
    color:var(--c2m-muted);
    font-size:11px;
    font-weight:700;
    text-transform:uppercase;
  }
  .c2m-site-row {
    display:flex;
    justify-content:space-between;
    gap:var(--c2m-s3);
    padding:9px 0;
    border-bottom:1px solid var(--c2m-line);
    color:var(--c2m-text);
    font-size:12px;
  }
  .c2m-site-count,.c2m-stat-empty {
    color:var(--c2m-muted);
    font-size:12px;
  }
  .c2m-stat-link {
    margin-top:var(--c2m-s6);
    padding:0;
    background:transparent;
    border:0;
    color:var(--c2m-muted);
    font:12px system-ui,sans-serif;
    text-decoration:underline;
    cursor:pointer;
  }
  [hidden] {
    display:none !important;
  }
  @keyframes c2m-shine {
    0%
    {
      background-position:0% 50%
    }
    100%
    {
      background-position:-250% 50%
    }
  }
  .c2m-update-overlay {
    position:fixed;
    inset:0;
    z-index:2147483647;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:20px;
    background:rgba(5,5,12,.68);
    backdrop-filter:blur(5px);
    opacity:0;
    visibility:hidden;
    pointer-events:none;
    transition:opacity .18s ease,visibility .18s;
  }
  .c2m-update-overlay.open {
    opacity:1;
    visibility:visible;
    pointer-events:auto;
  }
  .c2m-update-dialog {
    width:min(420px,100%);
    background:var(--c2m-surface);
    border:1px solid var(--c2m-line);
    border-radius:var(--c2m-r-lg);
    box-shadow:0 24px 70px rgba(0,0,0,.55);
    overflow:hidden;
    transform:translateY(10px) scale(.97);
    transition:transform .18s ease;
  }
  .c2m-update-overlay.open .c2m-update-dialog {
    transform:translateY(0) scale(1);
  }
  .c2m-update-head {
    display:flex;
    align-items:center;
    gap:12px;
    padding:18px;
    background: linear-gradient( 100deg, rgba(115,87,246,.14), rgba(255,107,87,.08) ), var(--c2m-surface);
    border-bottom:1px solid var(--c2m-line);
  }
  .c2m-update-icon {
    width:42px;
    height:42px;
    border-radius:12px;
    object-fit:cover;
    flex-shrink:0;
  }
  .c2m-update-title {
    margin:0;
    color:var(--c2m-text);
    font-size:16px;
    font-weight:750;
  }
  .c2m-update-version {
    margin-top:3px;
    color:var(--c2m-muted);
    font-size:11px;
  }
  .c2m-update-body {
    padding:18px;
  }
  .c2m-update-message {
    margin:0;
    color:var(--c2m-muted);
    font-size:13px;
    line-height:1.55;
  }
  .c2m-update-actions {
    display:flex;
    justify-content:flex-end;
    gap:8px;
    margin-top:18px;
  }
  .c2m-update-btn {
    border:1px solid var(--c2m-line);
    border-radius:var(--c2m-r-sm);
    background:rgba(255,255,255,.05);
    color:var(--c2m-text);
    padding:8px 13px;
    font:650 12px system-ui,sans-serif;
    cursor:pointer;
    transition:background .15s,border-color .15s,transform .15s;
  }
  .c2m-update-btn:hover {
    background:rgba(255,255,255,.1);
    border-color:rgba(255,255,255,.2);
  }
  .c2m-update-btn.primary {
    background:var(--c2m-gradient);
    border-color:transparent;
    color:#fff;
    box-shadow:0 4px 14px rgba(115,87,246,.25);
  }
  .c2m-update-btn.primary:hover {
    transform:translateY(-1px);
    filter:brightness(1.08);
  }
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
          <button class="c2m-toggle" data-role="toggle" title="ContextHop — Continue any AI chat in a new one.">
            <span class="c2m-toggle-label">ContextHop</span>
          </button>
          <button class="c2m-donate-toggle" data-role="support-toggle" title="Support ContextHop" type="button">☕</button>
        </div>
      </div>
    </div>
    <div class="c2m-toast" data-role="toast"></div>
    <div class="c2m-update-overlay" data-role="update-overlay">
    <div class="c2m-update-dialog" role="dialog" aria-modal="true">
      <div class="c2m-update-head">
        <img class="c2m-update-icon" src="${APP_ICON_IMG}" alt="">
        <div>
          <h3 class="c2m-update-title">Update available</h3>
          <div class="c2m-update-version" data-role="update-version"></div>
        </div>
      </div>

      <div class="c2m-update-body">
        <p class="c2m-update-message">
          A new version of ContextHop is ready. Update now to get the latest improvements and fixes.
        </p>

        <div class="c2m-update-actions">
          <button type="button" class="c2m-update-btn" data-role="update-later">
            Later
          </button>
          <button type="button" class="c2m-update-btn primary" data-role="update-now">
            Update now
          </button>
        </div>
      </div>
    </div>
  </div>`;
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
    const updateOverlay = qs('[data-role="update-overlay"]');
    const updateVersion = qs('[data-role="update-version"]');
    const updateNow = qs('[data-role="update-now"]');
    const updateLater = qs('[data-role="update-later"]');

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
    const toggleLabel = document.createElement('span');
    toggleLabel.className = 'c2m-toggle-label';
    toggleLabel.textContent = 'ContextHop';
    toggle.appendChild(toggleLabel);
    const toggleBadge = document.createElement('span');
    toggleBadge.className = 'c2m-toggle-badge';
    toggleBadge.textContent = '•';
    toggle.appendChild(toggleBadge);

    let capture = null;
    let docs = null;
    let mode = 'md';
    let view = 'preview';
    let reverse = false;
    let inlineUsage = null;

    function showToast(msg, duration) {
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(function () { toast.classList.remove('show'); }, duration || 1800);
    }

    function showUpdateDialog(version) {
      if (version) {
        updateVersion.textContent = 'Version ' + version + ' is available';
      } else {
        updateVersion.textContent = 'A new version is available';
      }

      updateOverlay.classList.add('open');
    }

    function hideUpdateDialog() {
      updateOverlay.classList.remove('open');
    }

    function applyExtensionUpdate() {
      updateNow.disabled = true;
      updateNow.textContent = 'Updating…';

      chrome.runtime.sendMessage({
        type: 'CONTEXTHOP_APPLY_UPDATE'
      });
    }

    updateNow.addEventListener('click', function (event) {
      event.stopPropagation();
      applyExtensionUpdate();
    });

    updateLater.addEventListener('click', function (event) {
      event.stopPropagation();
      hideUpdateDialog();
    });

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

    async function captureDoc(onProgress) {
      const conv = adapter.collectFullConversation
        ? await adapter.collectFullConversation(onProgress)
        : adapter.getConversation();
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

    function formatWeeklyReset(ts) {
      if (!ts) return '';
      const d = new Date(ts);
      const day = d.toLocaleDateString(undefined, { weekday: 'short' });
      let hours = d.getHours();
      const minutes = d.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const mm = minutes < 10 ? '0' + minutes : String(minutes);
      return day + ' ' + hours + ':' + mm + ' ' + ampm;
    }

    function buildUsageBlock(label, pct, resetText, showBar) {
      const isNum = typeof pct === 'number';
      const wrap = document.createElement('span');
      wrap.className = 'c2m-inline-claude-usage';
      wrap.style.color = isNum ? usageColor(pct) : '';
      wrap.appendChild(textElement('b', '', label + ' ' + (isNum ? pct + '%' : pct)));
      if (showBar && isNum) {
        const track = document.createElement('span');
        track.className = 'c2m-usage-track';
        const fill = document.createElement('span');
        fill.className = 'c2m-usage-fill';
        fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
        fill.style.background = usageColor(pct);
        track.appendChild(fill);
        wrap.appendChild(track);
      }
      if (resetText) wrap.appendChild(textElement('span', 'c2m-inline-reset', resetText));
      return wrap;
    }

    function appendClaudeUsage(row) {
      if (!C2M.claudeUsage) return;
      const snapshot = C2M.claudeUsage.getSnapshot();
      const hasSession = !!snapshot && typeof snapshot.sessionPct === 'number';
      row.appendChild(textElement('span', 'c2m-inline-separator', '·'));

      if (hasSession) {
        const sessionBlock = buildUsageBlock('Session', snapshot.sessionPct,
          formatResetIn(snapshot.sessionResetsAt), true);
        sessionBlock.classList.add('c2m-session-grow');
        row.appendChild(sessionBlock);
        if (typeof snapshot.weeklyPct === 'number') {
          const weeklyBlock = buildUsageBlock('Week', snapshot.weeklyPct, formatWeeklyReset(snapshot.weeklyResetsAt));
          weeklyBlock.classList.add('c2m-weekly');
          row.appendChild(textElement('span', 'c2m-inline-separator c2m-weekly c2m-push-end', '·'));
          row.appendChild(weeklyBlock);
        }
        return;
      }

      const domFallback = readLimitFromDom();
      if (domFallback) {
        const sessionBlock = buildUsageBlock('Session', 100, formatResetIn(domFallback.resetsAt), true);
        sessionBlock.classList.add('c2m-session-grow');
        row.appendChild(sessionBlock);
        return;
      }

      row.appendChild(textElement('span', 'c2m-inline-placeholder', 'Usage stats will show here once you send a message'));
    }

    function readLimitFromDom() {
      const text = document.body.innerText || '';
      if (!/out of free|hit your limit/i.test(text)) return null;
      const match = text.match(/until (\d{1,2}:\d{2}\s*[AP]M)/i) ||
        text.match(/reset[s]? at (\d{1,2}:\d{2}\s*[AP]M)/i);
      return { resetsAt: match ? parseClockTimeToday(match[1]) : null };
    }

    function parseClockTimeToday(timeStr) {
      const m = /(\d{1,2}):(\d{2})\s*([AP]M)/i.exec(timeStr);
      if (!m) return null;
      let hours = parseInt(m[1], 10);
      const minutes = parseInt(m[2], 10);
      const isPM = m[3].toUpperCase() === 'PM';
      if (isPM && hours !== 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
      const d = new Date();
      d.setHours(hours, minutes, 0, 0);
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
      return d.getTime();
    }

    function buildInlineActionButton(iconSvg, label, title, onClick) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'c2m-inline-action';
      btn.title = title;
      const icon = document.createElement('span');
      icon.className = 'c2m-inline-action-icon';
      icon.innerHTML = iconSvg;
      icon.setAttribute('aria-hidden', 'true');
      btn.appendChild(icon);
      if (label) btn.appendChild(textElement('span', 'c2m-inline-action-label', label));
      btn.addEventListener('click', function (event) {
        event.stopPropagation();
        onClick();
      });
      return btn;
    }

    async function quickCopyInline(format, btn) {
      showToast('Capturing full chat…', 6000);
      const cap = await captureDoc();
      if (!cap) return;
      const turns = cap.turns.map(function (t) {
        return format === 'md'
          ? { role: t.role, element: t.element }
          : { role: t.role, element: t.elementClean, tools: t.tools };
      });
      const text = format === 'md' ? C2M.export.buildDocument(cap.meta, turns) : C2M.export.buildYaml(cap.meta, turns);
      const ok = await C2M.export.copyText(text);
      if (btn) {
        btn.classList.add(ok ? 'c2m-flash-ok' : 'c2m-flash-fail');
        setTimeout(function () { btn.classList.remove('c2m-flash-ok', 'c2m-flash-fail'); }, 900);
      }
      showToast(ok
        ? 'Copied ' + format.toUpperCase() + '! Paste into a new chat.'
        : 'Copy failed', 3000);
      if (ok) recordUsage(format === 'md' ? 'copy-md' : 'copy-yaml');
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
      const brand = textElement('span', 'c2m-inline-label', 'ContextHop');
      brand.style.cursor = 'pointer';
      brand.title = 'Open ContextHop website';
      brand.addEventListener('click', function (event) {
        event.stopPropagation();
        window.open('https://contexthop.vercel.app', '_blank', 'noopener,noreferrer');
      });
      row.appendChild(brand);
      appendClaudeUsage(row);

      const actionGroup = document.createElement('span');
      actionGroup.className = 'c2m-inline-action-group';
      actionGroup.appendChild(buildInlineActionButton(MD_ICON_SVG, '', 'Copy chat context as Markdown', function () {
        quickCopyInline('md', mdBtn);
      }));
      const mdBtn = actionGroup.lastChild;
      actionGroup.appendChild(buildInlineActionButton(YAML_ICON_SVG, '', 'Copy chat context as YAML', function () {
        quickCopyInline('yaml', yamlBtn);
      }));
      const yamlBtn = actionGroup.lastChild;
      row.appendChild(actionGroup);

      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '4px';
      row.style.width = '100%';

      // Narrow composer: drop the weekly usage block if the row is actually
      // overflowing/wrapping (real measurement, not a guessed breakpoint).
      const host = inlineUsage.host;
      function updateCompact() {
        row.classList.remove('c2m-compact');
        requestAnimationFrame(function () {
          if (row.scrollWidth > host.clientWidth) row.classList.add('c2m-compact');
        });
      }
      updateCompact();
      if (inlineUsage.narrowObserver) inlineUsage.narrowObserver.disconnect();
      const narrowObserver = new ResizeObserver(updateCompact);
      narrowObserver.observe(host);
      inlineUsage.narrowObserver = narrowObserver;
    }

    function removeInlineUsage() {
      if (inlineUsage) {
        if (inlineUsage.narrowObserver) inlineUsage.narrowObserver.disconnect();
        if (inlineUsage.posObserver) inlineUsage.posObserver.disconnect();
        if (inlineUsage.mutationObserver) inlineUsage.mutationObserver.disconnect();
        if (inlineUsage.positionInterval) clearInterval(inlineUsage.positionInterval);
        if (inlineUsage.positionHost) {
          window.removeEventListener('scroll', inlineUsage.positionHost, true);
          window.removeEventListener('resize', inlineUsage.positionHost);
        }
        if (inlineUsage.host.parentNode) inlineUsage.host.parentNode.removeChild(inlineUsage.host);
      }
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
      if (!anchor || !anchor.parentNode) {
        removeInlineUsage();
        return;
      }

      if (inlineUsage && inlineUsage.anchor === anchor && inlineUsage.host.isConnected) {
        return;
      }

      removeInlineUsage();
      const host = document.createElement('div');
      host.style.cssText = 'display:block;width:100%;box-sizing:border-box;margin:0 0 10px;position:relative;isolation:isolate;';

      const usageShadow = host.attachShadow({ mode: 'open' });
      usageShadow.innerHTML = '<style>:host{display:block;margin:0;color:#8f96a3;font:11px/1.4 Inter,ui-sans-serif,system-ui,sans-serif;white-space:nowrap}.c2m-inline-usage{display:flex;align-items:center;gap:4px;opacity:.98;min-height:28px;width:100%;box-sizing:border-box;flex-wrap:wrap;background:#15151a;border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:6px 12px}.c2m-inline-icon{width:14px;height:14px;margin-right:2px;border-radius:4px}.c2m-inline-label{font-weight:650;background:linear-gradient(90deg,#7357f6 0%,#ff6b57 25%,#ffffff 50%,#ff6b57 75%,#7357f6 100%);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:c2m-shine 3s linear infinite;cursor:pointer}.c2m-inline-separator{padding:0 4px;color:#777184}.c2m-inline-claude-usage{display:inline-flex;align-items:center;gap:9px;color:#a3a9b5;margin:0 2px}.c2m-inline-claude-usage b{color:#c7cbd4;font-weight:650}.c2m-usage-track{display:inline-block;flex:1 1 auto;min-width:40px;height:4px;border-radius:2px;background:#3a3d45;overflow:hidden;vertical-align:middle}.c2m-session-grow{flex:1 1 auto;min-width:0}.c2m-push-end{margin-left:auto}.c2m-usage-fill{display:block;height:100%;background:linear-gradient(90deg,#7357f6,#ff6b57);border-radius:2px}.c2m-inline-reset{color:#777184}.c2m-inline-placeholder{flex:1 1 auto;min-width:0;color:#6f7684;font-style:italic}.c2m-inline-action-group{display:inline-flex;align-items:center;gap:4px;margin-left:6px;padding-left:6px;border-left:1px solid rgba(255,255,255,.14)}.c2m-inline-action{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:6px;background:transparent;color:#9aa0ac;width:22px;height:22px;padding:0;cursor:pointer;pointer-events:auto;transition:background .15s,color .15s,transform .15s}.c2m-inline-action:hover{background:rgba(255,255,255,.1);color:#f0f1f5;transform:translateY(-1px)}.c2m-inline-action-icon{display:inline-flex;line-height:0}.c2m-inline-action-icon svg{display:block}.c2m-inline-action.c2m-flash-ok{background:rgba(34,197,94,.22);color:#4ade80}.c2m-inline-action.c2m-flash-fail{background:rgba(239,68,68,.22);color:#f87171}.c2m-inline-coffee{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border:0;background:transparent;font-size:14px;line-height:1;padding:0;cursor:pointer;pointer-events:auto;opacity:.8;transition:opacity .15s,transform .15s}.c2m-inline-coffee:hover{opacity:1;transform:translateY(-1px)}.c2m-inline-open-hint{color:#7357f6;font-weight:700;margin-left:1px}.c2m-inline-usage.c2m-compact .c2m-weekly{display:none}@keyframes c2m-shine{0%{background-position:0% 50%}100%{background-position:-250% 50%}}</style>';
      const usageRow = document.createElement('span');
      usageRow.className = 'c2m-inline-usage';
      usageShadow.appendChild(usageRow);

      anchor.parentNode.insertBefore(host, anchor);

      inlineUsage = { anchor: anchor, host: host, row: usageRow };

      const snapshot = C2M.claudeUsage && C2M.claudeUsage.getSnapshot ? C2M.claudeUsage.getSnapshot() : null;
      if (snapshot && typeof snapshot.sessionPct === 'number') {
        supportPopover.classList.add('open');
        markSupportAutoShown();
      }

      C2M.stats.getStats().then(function (stats) {
        renderInlineUsage(stats);
      }).catch(function () {
        if (inlineUsage && inlineUsage.host) inlineUsage.host.style.visibility = 'hidden';
      });
    }

    function recordUsage(action) {
      C2M.stats.recordUsage(location.hostname, action).catch(function () { });
    }

    function syncToggleState() {
      const open = panel.classList.contains('open');
      toggle.title = open ? 'ContextHop — Click to collapse' : 'ContextHop — Continue any AI chat in a new one.';
      toggle.style.boxShadow = open ? '0 0 0 3px rgba(115,87,246,.18)' : 'none';
    }

    function updateToggleBadge() {
      const snapshot = C2M.claudeUsage && C2M.claudeUsage.getSnapshot ? C2M.claudeUsage.getSnapshot() : null;
      const sessionPct = snapshot && typeof snapshot.sessionPct === 'number' ? snapshot.sessionPct : null;
      if (sessionPct !== null) {
        toggleBadge.textContent = sessionPct + '%';
        toggleBadge.style.background = 'linear-gradient(120deg, ' + usageColor(Math.max(0, Math.min(100, sessionPct))) + ', rgba(115,87,246,.85))';
        return;
      }
      C2M.stats.getStats().then(function (stats) {
        const count = stats.perSite && stats.perSite[location.hostname] ? stats.perSite[location.hostname] : 0;
        toggleBadge.textContent = count ? String(count) : '1';
        toggleBadge.style.background = 'linear-gradient(120deg, rgba(115,87,246,.95), rgba(255,107,87,.95))';
      }).catch(function () { });
    }

    async function openPanel() {
      finishOnboarding();
      supportPopover.classList.remove('open');
      showToast('Capturing full chat…', 6000);
      capture = await captureDoc(function (pct) {
        if (pct < 100) showToast('Capturing full chat… ' + pct + '%', 6000);
      });
      if (!capture) return;
      rebuild();
      applyMode();
      panel.classList.add('open');
      syncToggleState();
      showToast('Captured ' + capture.turns.length + ' turns');
    }

    function closePanel() {
      panel.classList.remove('open');
      syncToggleState();
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

    function openSupport() {
      closePanel();
      supportPopover.classList.add('open');
      loadSupport(supportPopover, showToast);
    }

    function toggleSupport() {
      const open = supportPopover.classList.toggle('open');
      if (open) {
        closePanel();
        loadSupport(supportPopover, showToast);
      }
    }

    supportToggle.addEventListener('click', function (event) {
      event.stopPropagation();
      toggleSupport();
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

    qs('[data-role="refresh"]').addEventListener('click', async function () {
      const scroll = preview.scrollTop;
      showToast('Capturing full chat…', 6000);
      capture = await captureDoc();
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
        if (inlineUsage && C2M.claudeUsage && C2M.claudeUsage.getSnapshot && C2M.claudeUsage.getSnapshot()) {
          supportPopover.classList.add('open');
        }
      });
    }
    if (adapter.getInlineUsageAnchor) {
      refreshInlineUsage();
      setInterval(refreshInlineUsage, 2500);
    }
    syncToggleState();
    updateToggleBadge();
    setInterval(updateToggleBadge, 2500);
    // showOnboarding();
    applyView();

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
        if (!msg) return false;

        if (msg.type === 'CONTEXTHOP_UPDATE_AVAILABLE') {
          showUpdateDialog(msg.version);
          return false;
        }

        if (msg.type === 'CONTEXTHOP_GET_META') {
          // Lightweight: just what's already visible on screen, no scrolling.
          try {
            const conv = adapter.getConversation();
            if (!conv || !conv.turns.length) {
              sendResponse({ ok: false, error: 'No conversation found on this page.' });
              return false;
            }
            sendResponse({ ok: true, title: conv.title, turnCount: conv.turns.length });
          } catch (error) {
            sendResponse({ ok: false, error: String((error && error.message) || error) });
          }
          return false;
        }

        if (msg.type !== 'CONTEXTHOP_GET_EXPORT') return false;
        (async function () {
          try {
            capture = await captureDoc();
            if (!capture) {
              sendResponse({ ok: false, error: 'No conversation found on this page.' });
              return;
            }
            rebuild();
            const packTurns = capture.turns.map(function (p) {
              return { role: p.role, element: p.elementClean || p.element };
            });
            const contextPack = C2M.contextPack.build({ title: capture.meta.title, turns: packTurns });
            sendResponse({
              ok: true,
              title: capture.meta.title,
              base: capture.base,
              turnCount: capture.turns.length,
              md: docs.md,
              yaml: docs.yaml,
              contextPack: contextPack
            });
          } catch (error) {
            sendResponse({ ok: false, error: String((error && error.message) || error) });
          }
        })();
        return true;
      });
    }
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