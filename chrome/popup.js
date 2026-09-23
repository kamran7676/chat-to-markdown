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
  root.appendChild(element('p', 'subtitle', 'Support ContextHop with a coffee or direct wallet transfer.'));

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
})();
