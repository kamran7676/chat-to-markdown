# Privacy Policy — ContextHop

ContextHop works entirely on your machine.

- **No data collection.** The extension reads the conversation visible in the
  page you are on, converts it to Markdown or YAML locally, and hands the
  result to you (preview, clipboard, or download). Nothing is transmitted to
  any server — ours or anyone else's.
- **No accounts, no analytics, no tracking,** no remote code. All logic ships
  inside the extension bundle.
- **Permissions:**
  - The content script loads on all http(s) pages so it can recognize
    supported chat UIs wherever you use them — including self-hosted Open
    WebUI instances, which are detected by their DOM structure rather than
    by hostname. On pages it does not recognize, the script does nothing: no
    UI, no reads, no writes.
  - On a recognized chat site it reads the conversation you are viewing —
    the site you must already be logged into — so it can convert it for you.
  - `clipboardWrite` copies the generated context pack or Markdown/YAML to your
    clipboard when you press Copy.
  - `storage` remembers whether the ContextHop onboarding tip was dismissed.

Questions or concerns: open an issue at
<https://github.com/the-robot-lives/chat-to-markdown/issues>.
