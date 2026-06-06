# MarkdownNotes

MarkdownNotes is an LLM-maintained local wiki for turning private notes and source material into a durable, inspectable knowledge base.

The product is no longer positioned as a generic note app with RAG bolted on. The core architecture is:

1. Preserve imported raw sources exactly.
2. Generate and maintain markdown wiki pages from those sources.
3. Answer with wiki-first query retrieval before falling back to raw sources.
4. File useful answers back into the wiki.
5. Run wiki health checks so generated knowledge stays auditable.

Built with SvelteKit, TypeScript, SQLite, markdown vault files, and local LLMs through Ollama.

---

## Product model

### Raw sources

Raw sources are immutable imported materials. They can be pasted markdown, articles, transcripts, PDFs, web clips, manual text, or migrated legacy notes.

Each raw source is stored under the managed vault and cached in SQLite as a `raw_sources` row. Source imports preserve provenance with metadata such as `sourceType`, `sourceDate`, `tags`, `rawPath`, and `summaryPageId`.

### Wiki pages

Wiki pages are generated markdown artifacts under `wiki/` with SQLite metadata in `wiki_pages`.

Current page types include:

- `source-summary` pages under `wiki/sources/`
- `entity` pages under `wiki/entities/`
- `concept` pages under `wiki/concepts/`
- `question` pages under `wiki/questions/`
- system pages such as `wiki/index.md` and `wiki/log.md`

The markdown files are meant to stay human-readable and portable. SQLite is a fast cache and query index, not the only source of truth.

### Wiki mutations

Every ingest, answer filing, and maintenance pass can create a `wiki_mutations` row describing:

- trigger type
- source IDs involved
- changed page IDs
- created page IDs
- human-readable notes

This gives the local wiki an audit trail.

---

## Core workflows

### 1. Source ingestion

Import text through the Sources panel or `/api/sources/import`.

The ingest pipeline:

1. writes the raw source under `raw/`
2. creates a source-summary wiki page
3. extracts deterministic entity/concept suggestions
4. creates or updates related entity/concept pages
5. updates `wiki/index.md`
6. appends `wiki/log.md`
7. records a wiki mutation

### 2. Wiki-first query

`POST /api/query` searches wiki pages before raw source fallback.

The query pipeline:

- matches title, slug, summary, and markdown body
- builds answer context from wiki pages first
- falls back to raw sources only when wiki coverage is weak
- returns citation metadata and coverage state to the UI

The chat UI displays citation kind and whether fallback was used.

### 3. Answer filing

After a cited assistant answer, the UI can file the answer back into the wiki.

The answer filing workflow:

- rejects insufficient/error/no-citation answers
- drafts deterministic question pages
- saves useful answers under `wiki/questions/`
- updates index/log pages
- records a query-triggered mutation

### 4. Wiki health

The lint system checks generated wiki quality.

Current findings include:

- orphan pages with no backlinks or source citations
- broken Obsidian-style wiki links
- stale low-confidence or open-question pages
- deterministic `Claim: key = true/false` contradictions

The Wiki Health panel fetches `/api/wiki/lint` and renders actionable findings.

### 5. Legacy note migration

Legacy notes remain available while the new model ships.

`POST /api/migration/notes-to-sources` imports existing notes as `note` raw sources without deleting the original notes. The migration is idempotent using `legacy-note:<id>` tags, so repeating it does not duplicate raw sources.

---

## Managed vault layout

Per user, the app creates:

```text
data/vaults/<user-id>/
├── raw/       # imported source content
├── wiki/      # generated markdown wiki pages
├── schema/    # generated schema documentation
└── state/     # future rebuild/checkpoint state
```

Schema docs can be generated into `schema/` and describe raw sources, wiki pages, and wiki mutations.

---

## API endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/sources` | List raw sources |
| POST | `/api/sources` | Import a raw source via the source import route |
| POST | `/api/sources/import` | Import source text and create/update wiki pages |
| GET | `/api/wiki/index` | Read generated `wiki/index.md` |
| GET | `/api/wiki/log` | Read generated `wiki/log.md` |
| GET | `/api/wiki/mutations/latest` | Read latest wiki mutation |
| GET | `/api/wiki/lint` | Run wiki health checks |
| POST | `/api/wiki/file-answer` | File a cited answer as a question page |
| POST | `/api/migration/notes-to-sources` | Migrate legacy notes into raw sources |
| POST | `/api/query` | Ask a wiki-first local LLM question |
| GET/POST | `/api/notes` | Legacy notes API retained during migration |

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | SvelteKit + TypeScript |
| UI | Svelte 5 + Tailwind CSS |
| Local LLM | Ollama |
| Persistence | SQLite + managed markdown vault |
| Editor | CodeMirror 6 |
| Experimental graph | legacy entity/skills/self-improvement tooling under `/experimental/knowledge-graph` |
| Testing | Vitest + jsdom + @testing-library/svelte |

---

## Getting started

Use Node.js 22+ for local development in this repo.

```bash
cd web
npm install
npm run dev
```

If Ollama is used for query generation:

```bash
ollama pull llama3.2:3b
```

The app runs at `http://localhost:5173`.

---

## Testing

```bash
cd web
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx vitest run
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run check
```

Useful targeted suites:

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx vitest run src/lib/wiki/ingest
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx vitest run src/lib/wiki/query
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx vitest run src/lib/wiki/lint
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx vitest run src/lib/wiki/migration
```

See `TESTING_GUIDE.md` for the full ingest/query/lint/migration acceptance checklist.

---

## Project structure

```text
src/
├── lib/
│   ├── components/       # app panels, chat, source/wiki/health/migration UI
│   ├── server/           # auth, database, vault helpers
│   ├── stores/           # Svelte stores, including sources and legacy notes
│   ├── wiki/
│   │   ├── ingest/       # source import, summaries, index/log, page integration
│   │   ├── query/        # wiki-first retrieval, answer building, answer filing
│   │   ├── lint/         # wiki health detectors and aggregator
│   │   ├── migration/    # legacy notes to raw sources
│   │   ├── schema/       # generated schema documentation helpers
│   │   └── templates/    # deterministic markdown templates
│   └── types/
└── routes/api/           # source/wiki/query/migration endpoints
```

---

## Current scope and non-goals

The first success criterion is architectural correctness: raw sources, generated wiki pages, wiki-first answers, answer filing, linting, and safe migration.

Non-goals for this first pivot:

- perfect PDF/image ingestion
- production-grade multi-user collaboration
- flawless semantic contradiction detection
- automated web-feed ingestion
- remote sync
