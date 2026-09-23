chrome.runtime.onUpdateAvailable.addListener(function (details) {
    chrome.tabs.query({}, function (tabs) {
        tabs.forEach(function (tab) {
            if (!tab.id) return;

            chrome.tabs.sendMessage(
                tab.id,
                {
                    type: 'CONTEXTHOP_UPDATE_AVAILABLE',
                    version: details.version
                },
                function () {
                    void chrome.runtime.lastError;
                }
            );
        });
    });
});

chrome.runtime.onMessage.addListener(function (message) {
    if (!message) return;

    if (message.type === 'CONTEXTHOP_APPLY_UPDATE') {
        chrome.runtime.reload();
    }
});