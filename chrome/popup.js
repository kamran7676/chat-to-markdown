/* Toolbar popup: fixed ContextHop support information. */
(function () {
  const C2M = window.ChatToMarkdown || {};
  const support = C2M.support;
  const root = document.getElementById('popup-root');
  if (!support || !root) return;

  function assetUrl(path) {
    return chrome.runtime.getURL(path);
  }

  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  }

  function image(path, alt) {
    const node = document.createElement('img');
    node.setAttribute('src', assetUrl(path));
    node.setAttribute('alt', alt);
    return node;
  }

  function fallbackCopy(value) {
    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', '');
    input.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    return Promise.resolve(copied);
  }

  function copyText(value) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(value).then(function () { return true; }, function () {
        return fallbackCopy(value);
      });
    }
    return fallbackCopy(value);
  }

  function paymentCard(name, number, iconPath, className) {
    const card = element('section', 'card payment ' + className);
    const method = element('div', 'method');
    method.appendChild(image(iconPath, ''));
    method.appendChild(element('span', '', name));
    card.appendChild(method);
    const numberRow = element('div', 'number-row');
    numberRow.appendChild(element('span', 'number', number));
    const copy = element('button', '', '⧉ Copy');
    copy.type = 'button';
    copy.addEventListener('click', function () {
      copyText(number).then(function (copied) {
        if (!copied) return;
        copy.textContent = '✓ Copied!';
        copy.classList.add('copied');
        setTimeout(function () {
          copy.textContent = '⧉ Copy';
          copy.classList.remove('copied');
        }, 1300);
      });
    });
    numberRow.appendChild(copy);
    card.appendChild(numberRow);
    card.appendChild(element('span', 'account', 'Account title: ' + support.accountTitle));
    return card;
  }


  const header = element('header', 'header');
  header.appendChild(image(support.assets.appIcon, 'ContextHop'));
  header.lastChild.className = 'app-icon';
  header.appendChild(element('h1', '', 'ContextHop'));
  root.appendChild(header);
  root.appendChild(element('p', 'subtitle', 'Keep chatting anywhere — copy your context, or continue it in another AI.'));

  // --- Continue this chat (primary) ---
  const continueCard = element('section', 'card export-card');
  continueCard.appendChild(element('div', 'export-title', 'Continue this chat'));
  const exportStatus = element('div', 'export-status', 'Reading conversation…');
  continueCard.appendChild(exportStatus);

  const destRow = element('div', 'dest-row');
  const destinations = [
    { label: 'ChatGPT', url: 'https://chatgpt.com/' },
    { label: 'Gemini', url: 'https://gemini.google.com/app' },
    { label: 'Grok', url: 'https://grok.com/' }
  ];
  const destButtons = destinations.map(function (dest) {
    const btn = element('button', 'dest-btn', dest.label);
    btn.type = 'button';
    btn.disabled = true;
    btn.addEventListener('click', function () {
      if (!result) return;
      copyText(result.contextPack).then(function () {
        window.open(dest.url, '_blank');
      });
    });
    destRow.appendChild(btn);
    return btn;
  });
  continueCard.appendChild(destRow);

  const packBtn = element('button', 'pack-btn', '⧉ Copy Context Pack');
  packBtn.type = 'button';
  packBtn.disabled = true;
  packBtn.addEventListener('click', function () {
    if (!result) return;
    copyText(result.contextPack).then(function (copied) {
      if (!copied) return;
      packBtn.textContent = '✓ Copied!';
      setTimeout(function () { packBtn.textContent = '⧉ Copy Context Pack'; }, 1300);
    });
  });
  continueCard.appendChild(packBtn);
  continueCard.appendChild(element('div', 'pack-hint', 'Copies a compact summary of this chat, then opens the destination — paste it as your first message there.'));

  const toggleExportBtn = element('button', 'export-toggle', 'Export full transcript (.md / .yaml) ▾');
  toggleExportBtn.type = 'button';
  continueCard.appendChild(toggleExportBtn);

  const exportBody = element('div', 'export-body');
  const seg = element('div', 'seg');
  const mdBtn = element('button', 'seg-btn active', 'MD');
  mdBtn.type = 'button';
  const yamlBtn = element('button', 'seg-btn', 'YAML');
  yamlBtn.type = 'button';
  seg.appendChild(mdBtn);
  seg.appendChild(yamlBtn);
  exportBody.appendChild(seg);

  const actions = element('div', 'export-actions');
  const copyBtn = element('button', '', '⧉ Copy');
  copyBtn.type = 'button';
  copyBtn.disabled = true;
  const downloadBtn = element('button', '', '⇩ Download');
  downloadBtn.type = 'button';
  downloadBtn.disabled = true;
  actions.appendChild(copyBtn);
  actions.appendChild(downloadBtn);
  exportBody.appendChild(actions);
  continueCard.appendChild(exportBody);

  toggleExportBtn.addEventListener('click', function () {
    const open = exportBody.classList.toggle('open');
    toggleExportBtn.textContent = 'Export full transcript (.md / .yaml) ' + (open ? '▴' : '▾');
  });

  root.appendChild(continueCard);

  let mode = 'md';
  let result = null;

  function setMode(next) {
    mode = next;
    mdBtn.classList.toggle('active', mode === 'md');
    yamlBtn.classList.toggle('active', mode === 'yaml');
  }
  mdBtn.addEventListener('click', function () { setMode('md'); });
  yamlBtn.addEventListener('click', function () { setMode('yaml'); });

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  }

  copyBtn.addEventListener('click', function () {
    if (!result) return;
    copyText(mode === 'md' ? result.md : result.yaml).then(function (copied) {
      if (!copied) return;
      copyBtn.textContent = '✓ Copied!';
      copyBtn.classList.add('copied');
      setTimeout(function () {
        copyBtn.textContent = '⧉ Copy';
        copyBtn.classList.remove('copied');
      }, 1300);
    });
  });

  downloadBtn.addEventListener('click', function () {
    if (!result) return;
    downloadText(result.base + (mode === 'md' ? '.md' : '.yaml'), mode === 'md' ? result.md : result.yaml);
  });

  function showExportError(message) {
    exportStatus.textContent = message;
    exportStatus.classList.add('error');
  }

  function enableButtons() {
    destButtons.forEach(function (b) { b.disabled = false; });
    packBtn.disabled = false;
    copyBtn.disabled = false;
    downloadBtn.disabled = false;
  }

  if (!chrome.tabs) {
    showExportError('Open this on a supported AI chat tab to export.');
  } else {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const tab = tabs && tabs[0];
      if (!tab || !tab.id) {
        showExportError('No active tab found.');
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: 'CONTEXTHOP_GET_EXPORT' }, function (response) {
        if (chrome.runtime.lastError || !response) {
          showExportError('Open a supported AI chat tab (Claude, ChatGPT, Gemini) and try again.');
          return;
        }
        if (!response.ok) {
          showExportError(response.error || 'Could not read this conversation.');
          return;
        }
        result = response;
        exportStatus.textContent = (response.title || 'Untitled chat') + ' · ' + response.turnCount + ' turns';
        exportStatus.classList.remove('error');
        enableButtons();
      });
    });
  }

  // --- Support (secondary) ---
  root.appendChild(element('hr', 'divider'));
  root.appendChild(element('p', 'section-heading', 'Support the developer'));

  const coffeeCard = element('section', 'card');
  const coffee = document.createElement('a');
  coffee.className = 'coffee';
  coffee.setAttribute('href', support.coffeeUrl);
  coffee.setAttribute('target', '_blank');
  coffee.setAttribute('rel', 'noopener noreferrer');
  coffee.appendChild(image(support.assets.coffeeButton, 'Buy me a coffee'));
  coffeeCard.appendChild(coffee);
  coffeeCard.appendChild(element('span', 'account', 'For international supporters'));
  root.appendChild(coffeeCard);
  root.appendChild(paymentCard('JazzCash', support.jazzcashNumber, support.assets.jazzcashIcon, 'jazz'));
  root.appendChild(paymentCard('Easypaisa', support.easypaisaNumber, support.assets.easypaisaIcon, 'easy'));

  // --- Footer ---
  const manifest = chrome.runtime.getManifest ? chrome.runtime.getManifest() : {};
  const footer = element('footer', 'footer');
  const websiteLink = document.createElement('a');
  websiteLink.href = support.websiteUrl;
  websiteLink.target = '_blank';
  websiteLink.rel = 'noopener noreferrer';
  websiteLink.textContent = 'Website';
  footer.appendChild(websiteLink);

  const rateLink = document.createElement('a');
  rateLink.href = 'https://chrome.google.com/webstore/detail/' + chrome.runtime.id + '/reviews';
  rateLink.target = '_blank';
  rateLink.rel = 'noopener noreferrer';
  rateLink.textContent = '★ Rate us';
  footer.appendChild(rateLink);

  const helpLink = document.createElement('a');
  helpLink.href = support.websiteUrl + '/help';
  helpLink.target = '_blank';
  helpLink.rel = 'noopener noreferrer';
  helpLink.textContent = 'Help';
  footer.appendChild(helpLink);

  const changelogLink = document.createElement('a');
  changelogLink.href = support.websiteUrl + '/changelog';
  changelogLink.target = '_blank';
  changelogLink.rel = 'noopener noreferrer';
  changelogLink.textContent = 'Changelog';
  footer.appendChild(changelogLink);

  footer.appendChild(element('span', 'version', 'v' + (manifest.version || '')));
  root.appendChild(footer);
})();
