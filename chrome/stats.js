/* Local usage statistics. No conversation content is stored. */
(function () {
  const ROOT = typeof window !== 'undefined' ? window : globalThis;
  const C2M = (ROOT.ChatToMarkdown = ROOT.ChatToMarkdown || {});
  const KEY = 'contextHopStats';

  function emptyStats() {
    return {
      totalExports: 0,
      copyCount: 0,
      saveCount: 0,
      contextPackCopies: 0,
      perSite: {},
      firstUsedDate: null,
      lastUsedDate: null
    };
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function storage() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      throw new Error('chrome.storage.local is unavailable');
    }
    return chrome.storage.local;
  }

  function getStats() {
    return new Promise(function (resolve, reject) {
      try {
        storage().get(KEY, function (result) {
          if (chrome.runtime && chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          const saved = result && result[KEY];
          const stats = Object.assign(emptyStats(), saved || {});
          stats.perSite = Object.assign({}, saved && saved.perSite);
          resolve(stats);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function saveStats(stats) {
    return new Promise(function (resolve, reject) {
      try {
        storage().set({ [KEY]: stats }, function () {
          if (chrome.runtime && chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(stats);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function recordUsage(site, action) {
    return getStats().then(function (stats) {
      const hostname = String(site || 'unknown');
      const date = today();
      stats.perSite[hostname] = (stats.perSite[hostname] || 0) + 1;
      stats.firstUsedDate = stats.firstUsedDate || date;
      stats.lastUsedDate = date;

      if (action === 'copy') {
        stats.totalExports += 1;
        stats.copyCount += 1;
      } else if (action === 'save') {
        stats.totalExports += 1;
        stats.saveCount += 1;
      } else if (action === 'context-pack') {
        stats.contextPackCopies += 1;
      }

      return saveStats(stats);
    });
  }

  function resetStats() {
    return new Promise(function (resolve, reject) {
      try {
        storage().remove(KEY, function () {
          if (chrome.runtime && chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(emptyStats());
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  C2M.stats = {
    recordUsage: recordUsage,
    getStats: getStats,
    resetStats: resetStats
  };
})();