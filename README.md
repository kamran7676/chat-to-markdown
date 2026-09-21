# ContextHop

> Continue any AI chat in a new one.

Copy a compact context pack from ChatGPT, Claude or Gemini and continue your conversation in a fresh chat.

**Status:** v0.6.1 — works with ChatGPT, Claude, Gemini, z.ai, Open WebUI, use.ai, Le Chat, Grok, and Groq; ContextHop packs, Markdown/YAML preview, and tool-call summaries · **License:** MIT

## Why

Chats with LLMs are where real work happens, but every vendor locks the transcript
inside its own web UI. ContextHop extracts the conversation — turns, code blocks,
tables, math — and converts it to standard Markdown you can copy to the clipboard or
save as a `.md` file.

## Supported at launch

| Platform | Site |
|----------|------|
| ChatGPT | `chatgpt.com` |
| Claude | `claude.ai` |
| Gemini | `gemini.google.com` |
| Grok | `grok.com`, `x.com` |
| Le Chat (Mistral) | `chat.mistral.ai` |
| Cerebras Inference Chat | `chat.cerebras.ai` |
| LMArena | `lmarena.ai` |
| Open WebUI | self-hosted (generic DOM rules) |

**Shipped:** ChatGPT, **Claude** (live-verified selectors), **Gemini** (gemini.google.com, live-verified), **Open WebUI — any self-hosted instance** (pure DOM detection: `[id^="message-"]` + `.chat-user`/`.chat-assistant`; no configuration, the extension injects everywhere but stays inert on unrecognized pages; covers **z.ai**, whose chat is Open WebUI-derived — matched explicitly too), **use.ai** (live-verified; a Grok-powered front-end — model picker shows e.g. "Grok 4.6" — distinct from xAI's own grok.com), **Le Chat** (`chat.mistral.ai`, live-verified).
**Experimental** (selectors unverified — button simply won't appear until a matching pair hits): Grok (grok.com), Groq (chat.groq.com). The rest land adapter-by-adapter — see Development below.

## Under consideration (roadmap)

DeepSeek (`chat.deepseek.com`) · Qwen (`chat.qwen.ai`) · Kimi (`kimi.com`) ·
Microsoft Copilot (`copilot.microsoft.com`) · Meta AI (`meta.ai`) ·
HuggingChat (`huggingface.co/chat`) · Perplexity (`perplexity.ai`) · Poe (`poe.com`) ·
OpenRouter Chat (`openrouter.ai/chat`) · Character.AI (`character.ai`) ·
GLM (`chat.z.ai`) · MiniMax (`chat.minimax.io`)

Site adapters are small and isolated; PRs adding a new adapter are welcome once the
extension core lands.

## Features

- **Preview panel** — the export opens in a panel with **MD** / **YAML** mode tabs,
  plus Copy, Save, and Refresh; nothing leaves the page until you act
- **Message order** — the ⇅ toggle flips the export between chronological
  (oldest first) and newest-first
- **Markdown mode** — front-matter header, `#` title, `## User` / `## Assistant`
  turns separated by `* * *`, faithful code blocks / tables / lists / math
- **YAML mode** — the full thread as an API-format payload: a `messages:` list of
  `role:` / `content:` block-scalar entries; tool invocations become `role: tool`
  messages (`name:`, `content: tool-call-response: <status> response <size>`)
- **Tool calls, summarized** — collapsible tool chips (searches, browsing, code
  runs) export as `tool-call made to …` / `tool-call-response: …` lines instead
  of their collapsed payload
- **One-click copy / download** of the current conversation

## Planned
- **Front-matter header**: source site, model, conversation title, date, URL
- **Faithful conversion**: fenced code blocks (language-tagged), tables, lists, blockquotes
- **Turn-by-turn speaker labels** (`## User` / `## Assistant`, artifacts kept inline)
- **Batch export** of selected conversations as one file or a zip
- **No account, no telemetry** — parsing happens locally in the page

## Repository layout

```
chrome/
├── manifest.json             # MV3, content-script only (no build step)
└── src/
    ├── lib/
    │   ├── markdown.js       # DOM → Markdown converter (site-agnostic)
    │   └── export.js         # front-matter, filename, copy/download
    └── content/
        ├── adapters/         # one file per site; contract below
        │   ├── chatgpt.js
        │   └── index.js      # registry — picks the adapter for this site
        └── main.js           # floating MD button (shadow DOM)
test/                          # zero-dep node tests (mini-DOM + fixtures)
```

## Development

No build step, no dependencies.

```bash
node --test               # converter test suite (auto-discovers test/*.test.js)
```

To try it live: `chrome://extensions` → enable Developer mode → **Load unpacked** →
select `chrome/`. Open a supported chat and use the floating **ContextHop ▾** button
(Copy Context Pack / Copy Markdown / Download .md).

**Adding a platform:** create `chrome/src/content/adapters/<site>.js` that pushes an
adapter object onto `C2M.adapters` with `isCurrentSite()` and `getConversation()` →
`{title, turns: [{role: 'user'|'assistant', element}]}`; add its filename to
`manifest.json` `content_scripts.js` and the match pattern to `matches`. Adapters
speak in DOM elements; the converter never sees site specifics.

## Install

**Release zip (recommended):** grab `chat-to-markdown-v<version>.zip` from
[Releases](https://github.com/the-robot-lives/chat-to-markdown/releases), unzip,
then `chrome://extensions` (or `edge://extensions`) → Developer mode →
**Load unpacked** → select the unzipped folder.

**From source:** clone, then Load unpacked pointing at this repo's `chrome/`
directory. Every push to the `release` branch publishes a versioned zip with
patch auto-bumping (see [PUBLISHING.md](PUBLISHING.md)).

After installing or updating, reload the extension card and refresh the chat
tab — content scripts inject on page load.

## License

Based on chat-to-markdown by the-robot-lives (MIT)

[MIT](LICENSE)
