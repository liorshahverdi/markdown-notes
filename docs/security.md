# Security notes

Markdown Notes is currently local-first software. Treat production or multi-user deployment as experimental unless explicitly documented otherwise.

## Local data

The web app stores user data in `MARKDOWN_NOTES_DATA_DIR` or `web/data` by default. This directory can contain private notes, graph data, memory chunks, generated skills, raw sources, and generated wiki content. It must not be committed.

## Ollama URL policy

Server-side Ollama requests are restricted to loopback hosts by `web/src/lib/server/ollamaUrl.ts` to reduce SSRF risk. Supported hosts are `localhost`, `127.0.0.1`, and IPv6 loopback.

Chat and embedding requests are routed through server-side proxies rather than direct arbitrary browser calls.

## Authentication

The current authentication flow is intended for local/development use. Before exposing the app beyond localhost, review password policy, signup policy, rate limiting, session handling, TLS, backup/restore procedures, and data retention.

## Experimental wiki/source ingestion

The wiki/source subsystem can preserve and generate additional copies/summaries of imported content under the local vault. Treat those generated files as private data equivalent to notes.

## Dependency audit

Run before releases:

```bash
cd web && npm audit
cd web/cli && npm audit
```

See [../SECURITY.md](../SECURITY.md) for vulnerability reporting.
