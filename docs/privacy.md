# Privacy

Markdown Notes is designed around local-first storage.

- Notes, raw sources, wiki pages, sessions, and caches are stored locally.
- The web app default data directory is `./data`; configure `MARKDOWN_NOTES_DATA_DIR` to move it.
- Ollama requests are intended to go to a local loopback server.
- Do not include private notes or vault data in issues, screenshots, logs, or pull requests.

If you configure integrations beyond local Ollama in the future, document what data leaves the machine and how it is protected.
