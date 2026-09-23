'use strict';

const test = require('node:test');
const assert = require('node:assert');

globalThis.window = globalThis;
let stored = {};
globalThis.chrome = {
  runtime: { lastError: null },
  storage: {
    local: {
      get: function (key, callback) { callback(stored); },
      set: function (value, callback) {
        stored = Object.assign(stored, value);
        callback();
      },
      remove: function (key, callback) {
        delete stored[key];
        callback();
      }
    }
  }
};

require('../chrome/stats.js');
const stats = globalThis.ChatToMarkdown.stats;

test('records exports, context packs, dates, and per-site usage', async () => {
  await stats.resetStats();
  assert.deepEqual((await stats.getStats()).perSite, {});

  await stats.recordUsage('chatgpt.com', 'copy');
  await stats.recordUsage('chatgpt.com', 'save');
  await stats.recordUsage('claude.ai', 'context-pack');

  const result = await stats.getStats();
  assert.equal(result.totalExports, 2);
  assert.equal(result.copyCount, 1);
  assert.equal(result.saveCount, 1);
  assert.equal(result.contextPackCopies, 1);
  assert.deepEqual(result.perSite, { 'chatgpt.com': 2, 'claude.ai': 1 });
  assert.match(result.firstUsedDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(result.lastUsedDate, result.firstUsedDate);
});

test('resetStats clears usage without affecting unrelated storage', async () => {
  stored.otherSetting = true;
  await stats.recordUsage('gemini.google.com', 'copy');
  await stats.resetStats();

  assert.equal(stored.otherSetting, true);
  assert.equal((await stats.getStats()).totalExports, 0);
  assert.deepEqual((await stats.getStats()).perSite, {});
});