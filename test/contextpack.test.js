'use strict';

const test = require('node:test');
const assert = require('node:assert');

globalThis.window = globalThis;
require('../chrome/src/lib/markdown.js');
require('../chrome/src/lib/contextpack.js');
const C2M = globalThis.ChatToMarkdown;
const { h } = require('./mini-dom');

test('build: five-line local summary and recent turns', () => {
  const turns = Array.from({ length: 7 }, function (_, i) {
    return {
      role: i % 2 ? 'assistant' : 'user',
      element: h('div', {}, 'turn ' + i)
    };
  });
  turns[0].element = h('div', {}, 'Build a parser');
  turns[1].element = h('div', {}, h('h2', {}, 'Plan'), h('pre', {},
    h('code', { class: 'language-js' }, 'const ok = true;')));
  turns[5].element = h('div', {}, 'The parser is ready.');
  const pack = C2M.contextPack.build({ title: 'Parser | Notes', turns: turns });
  const lines = pack.split('\n');

  assert.equal(lines[0], 'Continue from this context:');
  assert.equal(lines[1], 'Parser | Notes');
  assert.equal(lines[2], '- First request: Build a parser');
  assert.equal(lines[3], '- Headings: Plan');
  assert.equal(lines[4], '- Code block languages: js');
  assert.equal(lines[5], '- Last assistant conclusion: The parser is ready.');
  assert.equal(lines[6], '- Total turns: 7');
  assert.equal(lines[7], 'Recent turns:');
  assert.equal(pack.match(/^(User|Assistant):$/gm).length, 6);
  assert.ok(pack.includes('User:\nturn 2'));
  assert.ok(!pack.includes('turn 0'));
});

test('build: preserves markdown tables and fenced code in recent turns', () => {
  const table = h('table', {},
    h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'A|B'))),
    h('tbody', {}, h('tr', {}, h('td', {}, 'alpha'), h('td', {}, 'gamma'))));
  const code = h('pre', {}, h('code', { class: 'language-python' }, 'print("ok")'));
  const pack = C2M.contextPack.build({ title: 'Safe', turns: [
    { role: 'user', element: h('div', {}, table) },
    { role: 'assistant', element: h('div', {}, code) }
  ] });

  assert.ok(pack.includes('| Name | A\\|B |'));
  assert.ok(pack.includes('```python\nprint("ok")\n```'));
});
