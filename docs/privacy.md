# Privacy

Markdown Notes is designed around local-first storage.

- Notes, folders, graph data, graph review decisions, generated skills, raw sources, wiki pages, sessions, API token metadata, memory chunks, and caches are stored locally.
- The web app default data directory is `web/data`; configure `MARKDOWN_NOTES_DATA_DIR` to move it.
- Ollama requests are intended to go to a local loopback server and are routed through server-side proxies.
- Default chat uses local notes + graph memory. Rejected graph edges are excluded from default chat evidence.
- Experimental wiki/source context is opt-in. Normal note saves do not create raw-source or generated-wiki artifacts.
- Do not include private notes, vault data, API tokens, graph review decisions, screenshots, logs, SQLite databases, or generated wiki content in issues, pull requests, commits, or support requests unless explicitly scrubbed.

If you configure integrations beyond local Ollama in the future, document exactly what data leaves the machine and how it is protected.
