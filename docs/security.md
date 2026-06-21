# Security notes

Markdown Notes is currently local-first software. Treat production or multi-user deployment as experimental unless explicitly documented otherwise.

## Local data

The web app stores user data in `MARKDOWN_NOTES_DATA_DIR` or `web/data` by default. This directory can contain private notes, graph data, graph review decisions, hashed API token metadata, memory chunks, generated skills, raw sources, and generated wiki content. It must not be committed.

## Ollama URL policy

Server-side Ollama requests are restricted to loopback hosts by `web/src/lib/server/ollamaUrl.ts` to reduce SSRF risk. Supported hosts are `localhost`, `127.0.0.1`, and IPv6 loopback.

Chat and embedding requests are routed through server-side proxies rather than direct arbitrary browser calls.

## Authentication

The current authentication flow is intended for local/development use. Browser requests use HTTP-only session cookies. Local automation, CLI, and future MCP adapters can use API tokens in the `Authorization: Bearer mnpat_...` header.

API tokens are stored hashed in SQLite and the full token is shown only when created. Token metadata includes name, prefix, scopes, creation time, optional expiry, last-used time, and revocation time. Token management through `/api/tokens` requires a browser session; API tokens cannot mint additional tokens by default.

Before exposing the app beyond localhost, review password policy, signup policy, rate limiting, session handling, token scope policy, TLS, backup/restore procedures, and data retention.

## Graph review state

Graph edge accept/reject decisions are stored locally in SQLite. Rejected edges are excluded from normal graph and chat retrieval. Use `GET /api/graph?includeRejected=1` only for diagnostics when rejected-edge state is intentionally needed.

## Experimental wiki/source ingestion

The wiki/source subsystem can preserve and generate additional copies/summaries of imported content under the local vault. Treat those generated files as private data equivalent to notes. Ordinary note saves do not create or update raw-source/wiki artifacts; source/wiki import and migration are explicit experimental actions.

## Dependency audit

Run before releases:

```bash
cd web && npm audit
cd web/cli && npm audit
```

See [../SECURITY.md](../SECURITY.md) for vulnerability reporting.
