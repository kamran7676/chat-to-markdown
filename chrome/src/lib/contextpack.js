/*
 * chat-to-markdown - compact, local-only context pack assembly.
 * The input is the site-agnostic adapter conversation contract.
 */
(function () {
  const ROOT = typeof window !== 'undefined' ? window : globalThis;
  const C2M = (ROOT.ChatToMarkdown = ROOT.ChatToMarkdown || {});

  function oneLine(text, fallback) {
    const line = String(text || '').replace(/\s+/g, ' ').trim();
    return line || fallback;
  }

  function lastAssistant(turns) {
    for (let i = turns.length - 1; i >= 0; i--) {
      if (turns[i].role === 'assistant') return turns[i];
    }
    return null;
  }

  function headings(markdown) {
    const found = [];
    String(markdown).split('\n').forEach(function (line) {
      const match = line.match(/^#{1,6}\s+(.+?)\s*$/);
      if (match) found.push(match[1]);
    });
    return found.length ? found.slice(0, 4).join(', ') : 'none';
  }

  function codeLanguages(markdown) {
    const found = [];
    let inside = false;
    String(markdown).split('\n').forEach(function (line) {
      const fence = line.match(/^```([^\n]*)$/);
      if (!fence) return;
      if (inside) {
        inside = false;
        return;
      }
      inside = true;
      const value = fence[1].trim() || 'plain text';
      if (found.indexOf(value) === -1) found.push(value);
    });
    return found.length ? found.join(', ') : 'none';
  }

  function build(conversation) {
    const turns = conversation && Array.isArray(conversation.turns)
      ? conversation.turns : [];
    const rendered = turns.map(function (turn) {
      return { role: turn.role, markdown: C2M.domToMarkdown(turn.element) };
    });
    const first = rendered.find(function (turn) { return turn.role === 'user'; });
    const last = lastAssistant(rendered);
    const allMarkdown = rendered.map(function (turn) { return turn.markdown; }).join('\n\n');
    const recent = rendered.slice(-6);
    const summary = [
      '- First request: ' + oneLine(first && first.markdown, 'none'),
      '- Headings: ' + headings(allMarkdown),
      '- Code block languages: ' + codeLanguages(allMarkdown),
      '- Last assistant conclusion: ' + oneLine(last && last.markdown, 'none'),
      '- Total turns: ' + rendered.length
    ];
    const out = ['Continue from this context:', oneLine(conversation && conversation.title, 'Untitled')]
      .concat(summary)
      .concat(['Recent turns:']);
    recent.forEach(function (turn) {
      out.push(turn.role === 'assistant' ? 'Assistant:' : 'User:');
      out.push(turn.markdown);
    });
    return out.join('\n') + '\n';
  }

  C2M.contextPack = { build: build };
})();
