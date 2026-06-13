# Privacy

Markdown Notes is designed around local-first storage.

- Notes, folders, graph data, generated skills, raw sources, wiki pages, sessions, memory chunks, and caches are stored locally.
- The web app default data directory is `web/data`; configure `MARKDOWN_NOTES_DATA_DIR` to move it.
- Ollama requests are intended to go to a local loopback server and are routed through server-side proxies.
- Default chat uses local notes + graph memory. Experimental wiki/source context is opt-in.
- Do not include private notes, vault data, screenshots, logs, SQLite databases, or generated wiki content in issues, pull requests, commits, or support requests unless explicitly scrubbed.

If you configure integrations beyond local Ollama in the future, document exactly what data leaves the machine and how it is protected.
