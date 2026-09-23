/* Fixed support details shared by ContextHop surfaces. */
(function () {
  const ROOT = typeof window !== 'undefined' ? window : globalThis;
  const C2M = (ROOT.ChatToMarkdown = ROOT.ChatToMarkdown || {});

  C2M.support = Object.freeze({
    coffeeUrl: 'https://buymeacoffee.com/kamranameer76',
    jazzcashNumber: 'PK53JCMA0109923111507344',
    easypaisaNumber: 'PK47TMFB0000000021975520',
    accountTitle: 'Kamran Ameer',
    websiteUrl: 'https://chatup.therobot.codes',
    assets: Object.freeze({
      appIcon: 'icons/app-icon.png',
      coffeeButton: 'icons/buymeacoffee-button.png',
      easypaisaIcon: 'icons/easypaisa-icon.png',
      jazzcashIcon: 'icons/jazzcash-icon.png'
    })
  });
})();
