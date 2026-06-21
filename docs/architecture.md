# Architecture

Markdown Notes contains two related apps. The active product is the `web/` app.

## Web app overview

The web app is a local-first SvelteKit application. It stores private runtime data in SQLite and managed markdown vault files under `MARKDOWN_NOTES_DATA_DIR` or `web/data`.

The current product model is note-first:

1. User-authored markdown notes are the canonical knowledge source.
2. Notes are saved to a per-user local vault and cached/indexed in SQLite.
3. Entity, relation, folder, link, and Mermaid information produce a knowledge graph.
4. Chat retrieves notes + graph memory by default.
5. Persisted graph review decisions are applied before graph evidence reaches chat or the normal graph API.
6. Ollama is called only when deterministic memory recall is insufficient.
7. Generated wiki/source ingestion remains available as an explicit experimental subsystem.

## Core layers

- `web/src/routes` — SvelteKit pages and API routes.
- `web/src/lib/components` — editor, sidebar, chat, graph, skill, and maintenance UI.
- `web/src/lib/server` — auth, database, vault, note file, graph snapshot, and server-only helpers.
- `web/src/lib/stores` — Svelte stores for notes, folders, graph, chat state, and local model config.
- `web/src/lib/memory` — note/graph memory context building, local memory index, synthesized recall.
- `web/src/lib/vector` — RAG prompt assembly, Ollama streaming parser, embeddings, vector/reranker helpers.
- `web/src/lib/graph` — entity extraction, relationship inference, graph scoring, provenance, edge review helpers.
- `web/src/lib/wiki` — experimental source/wiki ingestion, wiki-first query, linting, answer filing, migration.
- `web/src/lib/skills` — graph-derived skill generation and export.

## Data layout

Per user, the app creates a managed vault:

```text
data/vaults/<user-id>/
├── notes/     # canonical markdown notes
├── raw/       # experimental imported sources
├── wiki/      # experimental generated wiki pages
├── schema/    # generated schema docs
└── state/     # runtime/rebuild state
```

SQLite stores users/sessions, hashed API token metadata, note metadata caches, wiki/source metadata, memory chunks, graph relation review decisions, and other local indexes. Markdown files remain portable and inspectable.

## Chat/query flow

`POST /api/query` is the default chat route.

For notes+graph chat it:

1. loads notes/folders for the authenticated user
2. opens an NDJSON stream immediately for interactive requests
3. loads persisted graph relation reviews for the user
4. performs lexical/title retrieval and persisted memory-index search
5. expands graph context while excluding rejected edges
6. builds note citations and graph citations
7. returns synthesized high-confidence answers directly where safe
8. otherwise builds an Ollama chat prompt with note text first and graph links as supporting context
9. streams Ollama tokens back to the UI

The prompt explicitly prevents raw graph-edge syntax from being used as an answer. Graph links are supporting context; note text is the evidence source for factual answers.

## Knowledge graph

The graph is rebuilt from notes/folders and includes entity/relation provenance. It supports graph visualization, retrieval expansion, skill workflows, and low-confidence/model-inferred edge review helpers.

Graph accept/reject decisions are persisted in SQLite by stable relation review keys derived from endpoint names and relation type. Normal graph and chat retrieval apply those reviews and exclude rejected edges. Diagnostics can request rejected edges explicitly with `GET /api/graph?includeRejected=1`.

The review queue exists but is not yet central to the graph UX. Current UX work should prioritize exploration, evidence, filtering, and clear explanations of why nodes/edges are connected.

## Experimental wiki subsystem

The source/wiki subsystem is still present but opt-in. It can import raw sources, generate markdown wiki pages, lint generated wiki pages, file cited answers, and migrate legacy notes. Normal note saves do not mirror notes into raw sources or generated wiki pages. It should not be considered the default answer path unless the user enables experimental wiki context.

## Authentication and local automation

Browser users authenticate with local session cookies. CLI, automation, and future MCP adapters can use scoped local API tokens via `Authorization: Bearer mnpat_...`. Token records are stored hashed in SQLite, full tokens are shown only at creation time, and `/api/tokens` management requires a browser session.

## Ollama integration

Server-side Ollama requests are restricted to loopback hosts by `web/src/lib/server/ollamaUrl.ts`. The UI checks Ollama health through server proxies and query/chat requests are streamed to prevent long silent waits.

## CLI

The CLI lives in `web/cli/` and talks to the web app API.

## Swift app

The native macOS app lives in `MarkdownNotes/` and is built as a Swift package. It contains SwiftUI views, note models, Markdown rendering/highlighting utilities, and XCTest coverage.
