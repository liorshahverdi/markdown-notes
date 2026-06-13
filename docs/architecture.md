# Architecture

Markdown Notes contains two related apps. The active product is the `web/` app.

## Web app overview

The web app is a local-first SvelteKit application. It stores private runtime data in SQLite and managed markdown vault files under `MARKDOWN_NOTES_DATA_DIR` or `web/data`.

The current product model is note-first:

1. User-authored markdown notes are the canonical knowledge source.
2. Notes are saved to a per-user local vault and cached/indexed in SQLite.
3. Entity, relation, folder, link, and Mermaid information produce a knowledge graph.
4. Chat retrieves notes + graph memory by default.
5. Ollama is called only when deterministic memory recall is insufficient.
6. Generated wiki/source ingestion remains available as an experimental subsystem.

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

SQLite stores users/sessions, note metadata caches, wiki/source metadata, memory chunks, graph-related data, and other local indexes. Markdown files remain portable and inspectable.

## Chat/query flow

`POST /api/query` is the default chat route.

For notes+graph chat it:

1. loads notes/folders for the authenticated user
2. opens an NDJSON stream immediately for interactive requests
3. performs lexical/title retrieval and persisted memory-index search
4. builds note citations and graph citations
5. returns synthesized high-confidence answers directly where safe
6. otherwise builds an Ollama chat prompt with note text first and graph links as supporting context
7. streams Ollama tokens back to the UI

The prompt explicitly prevents raw graph-edge syntax from being used as an answer. Graph links are supporting context; note text is the evidence source for factual answers.

## Knowledge graph

The graph is rebuilt from notes/folders and includes entity/relation provenance. It supports graph visualization, retrieval expansion, skill workflows, and low-confidence/model-inferred edge review helpers.

The review queue exists but is not yet central to the graph UX. Current UX work should prioritize exploration, evidence, filtering, and clear explanations of why nodes/edges are connected.

## Experimental wiki subsystem

The source/wiki subsystem is still present but opt-in. It can import raw sources, generate markdown wiki pages, lint generated wiki pages, file cited answers, and migrate legacy notes. It should not be considered the default answer path unless the user enables experimental wiki context.

## Ollama integration

Server-side Ollama requests are restricted to loopback hosts by `web/src/lib/server/ollamaUrl.ts`. The UI checks Ollama health through server proxies and query/chat requests are streamed to prevent long silent waits.

## CLI

The CLI lives in `web/cli/` and talks to the web app API.

## Swift app

The native macOS app lives in `MarkdownNotes/` and is built as a Swift package. It contains SwiftUI views, note models, Markdown rendering/highlighting utilities, and XCTest coverage.
