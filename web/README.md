# MarkdownNotes Web

MarkdownNotes Web is a local-first markdown notes app with a graph-powered memory layer and optional local-model assistance through Ollama.

The current product center is no longer a wiki-first ingestion console. The default workflow is:

1. Write or import markdown notes.
2. Persist notes in a local per-user vault.
3. Extract entities, relationships, Mermaid diagrams, and provenance into a knowledge graph.
4. Ask chat questions against notes + graph memory by default.
5. Use the experimental wiki/source ingestion system only when explicitly needed.
6. Generate skills from meaningful graph context.

Built with SvelteKit, Svelte 5, TypeScript, SQLite, markdown vault files, CodeMirror, Mermaid, and Ollama.

---

## Current product model

### Notes and vault files

Notes are the primary user-authored knowledge source. Each authenticated local user gets a managed vault under:

```text
data/vaults/<user-id>/
├── notes/     # canonical markdown notes
├── raw/       # imported experimental source content
├── wiki/      # generated experimental wiki pages
├── schema/    # generated schema docs
└── state/     # runtime/rebuild state
```

Set `MARKDOWN_NOTES_DATA_DIR` to move runtime data out of `web/data`.

### Knowledge graph

The graph is built from notes, links, tags, folders, Mermaid diagrams, extracted entities, and relation provenance. It powers:

- graph visualization under `/graph`
- note/detail context
- chat memory retrieval expansion
- skill candidate generation
- low-confidence/model-inferred edge review helpers

The review queue exists, but it is not yet a primary workflow. Treat it as an advanced/experimental surface until the graph UI is redesigned around evidence and review.

### Chat memory

Default chat uses notes + graph memory, not generated wiki pages.

`POST /api/query` now:

- reads the authenticated user's notes
- performs fast lexical/title matching
- uses persisted server-side memory chunks/embeddings when available
- expands context with graph evidence
- streams an NDJSON response immediately so the UI does not appear hung
- synthesizes simple high-confidence answers without waiting for Ollama when safe
- otherwise routes to Ollama through loopback-only server-side requests
- presents graph links as supporting context, not as answers

The chat UI streams tokens into a single assistant message, displays memory coverage such as `Memory evidence: 1 note · 3 graph edges`, and has an opt-in checkbox for experimental wiki context.

### Experimental wiki/source subsystem

The previous LLM-maintained local wiki remains available under `/experimental/wiki` and maintenance routes. It supports raw source import, generated wiki pages, wiki lint, answer filing, and legacy note migration, but it is no longer the default chat retrieval path.

---

## API endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET/POST/DELETE | `/api/notes` | Local note CRUD and memory indexing |
| POST | `/api/query` | Default notes+graph chat query; streams with `stream: true` |
| GET | `/api/graph` | Graph data built from notes |
| POST | `/api/skills` | Skill generation/export workflows |
| GET | `/api/ollama/health` | Loopback Ollama health proxy |
| POST | `/api/ollama/chat` | Loopback Ollama chat proxy |
| POST | `/api/ollama/embed` | Loopback Ollama embeddings proxy |
| POST | `/api/ollama/json` | Loopback Ollama JSON helper |
| GET/POST | `/api/sources` | Experimental raw-source listing/import |
| POST | `/api/sources/import` | Experimental source-to-wiki ingest |
| GET | `/api/wiki/index` | Experimental generated wiki index |
| GET | `/api/wiki/log` | Experimental generated wiki log |
| GET | `/api/wiki/lint` | Experimental wiki health checks |
| POST | `/api/wiki/file-answer` | File cited answers to experimental wiki pages |
| POST | `/api/migration/notes-to-sources` | Experimental/idempotent legacy note migration |

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | SvelteKit + TypeScript |
| UI | Svelte 5 + Tailwind CSS |
| Local LLM | Ollama over loopback server proxies |
| Persistence | SQLite + managed markdown vault |
| Editor | CodeMirror 6 |
| Diagrams | Mermaid |
| Graph | deterministic extraction + provenance helpers |
| Vector memory | Ollama embeddings with Xenova fallback paths |
| Testing | Vitest + jsdom + @testing-library/svelte; ad hoc Playwright QA |

---

## Getting started

Use Node.js 22+.

```bash
cd web
npm ci
npm run dev
```

Optional local models:

```bash
ollama pull llama3.2:3b
ollama pull nomic-embed-text
ollama serve
```

The app runs at `http://localhost:5173` by default.

---

## Testing

```bash
cd web
npm run check
npm test
npm run build
```

Useful targeted suites:

```bash
npm test -- --run src/lib/memory
npm test -- --run src/routes/api/query
npm test -- --run src/lib/vector/ragPipeline.streaming.test.ts
npm test -- --run src/lib/graph
npm test -- --run src/lib/wiki/query
```

See `TESTING_GUIDE.md` for manual and automated acceptance guidance.

---

## Project structure

```text
src/
├── lib/
│   ├── components/       # editor, chat, graph, skill, wiki/maintenance UI
│   ├── graph/            # extraction, scoring, review, provenance, inference helpers
│   ├── memory/           # notes+graph chat retrieval and synthesized recall
│   ├── server/           # auth, database, vault, graph snapshot, note file helpers
│   ├── stores/           # Svelte stores for notes, folders, graph, chat, rag config
│   ├── vector/           # RAG prompt assembly, embeddings, vector store/reranker helpers
│   ├── wiki/             # experimental source/wiki ingest, query, lint, migration
│   └── skills/           # graph-derived skill generation/export helpers
└── routes/
    ├── graph/            # graph page entry
    ├── maintenance/      # maintenance/experimental admin surfaces
    ├── skills/           # skill views
    └── api/              # notes/query/graph/ollama/source/wiki endpoints
```

---

## Current non-goals

- Exposing the app as a hardened multi-user production service.
- Treating generated wiki pages as the default source of truth.
- Returning ungrounded chat answers when notes/graph evidence is missing.
- Making the review queue the primary graph UX before the graph exploration flow is redesigned.
