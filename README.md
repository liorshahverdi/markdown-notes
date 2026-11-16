# Markdown Notes

Markdown Notes is a local-first markdown notes workspace with graph-powered memory and local-model assistance through llama.cpp (Laguna XS 2.1).

This repository contains two related applications:

- `web/` — the active SvelteKit app for local-first notes, graph memory, chat, skills, and experimental wiki tooling.
- `MarkdownNotes/` — a native Swift/macOS markdown notes app kept in the repository with its own tests.

## Repository map

```text
.
├── web/             # SvelteKit + TypeScript local-first notes app
│   ├── src/         # routes, components, stores, server helpers, graph/memory/wiki logic
│   ├── cli/         # TypeScript command-line client for the web app
│   └── data/        # local runtime data when MARKDOWN_NOTES_DATA_DIR is not set; do not commit
├── MarkdownNotes/   # Native Swift/macOS Markdown notes app
│   ├── Sources/     # Swift app source code
│   └── Tests/       # Swift package tests
├── docs/            # Architecture, development, security, roadmap, QA, and planning docs
└── README.md        # Top-level project overview
```

## Current status

The active web app has pivoted back to a note-first product model:

- user-authored markdown notes are the source of truth
- the knowledge graph is built from notes, entities, links, folders, and Mermaid diagrams
- chat defaults to notes + graph memory
- Laguna XS 2.1 via llama.cpp is used when deterministic memory recall is insufficient
- retrieval uses keywords and graph evidence; neural embedding inference is disabled
- generated wiki/source ingestion remains available as an explicit experimental subsystem, not a normal note-save side effect
- graph review decisions are persisted and rejected edges are excluded from normal graph/chat retrieval
- local API tokens support CLI automation and future MCP adapters

The project is still local-first/pre-release software. Production or non-local deployment requires additional hardening.

## Quickstart

### Web app

```bash
cd web
npm ci
npm run dev
```

The web app defaults to `web/data` for local runtime state. Set `MARKDOWN_NOTES_DATA_DIR` to use another location.

If native install scripts fail on the optional transitive `sharp` dependency, the API/server path can be built locally with:

```bash
cd web
npm ci --ignore-scripts
npm rebuild better-sqlite3
npm run build
```


### Docker Compose

```bash
docker compose up -d --build
curl -i http://127.0.0.1:5173/api/notes
```

The compose service stores app data in the named volume `markdown-notes-data`, exposes port `5173`, and sets `MARKDOWN_NOTES_DATA_DIR=/data` inside the container. A `401 Unauthorized` response from `/api/notes` is a healthy unauthenticated API smoke test; create/login to a browser session and mint a read-only API token for automation.

Local model configuration belongs to the app server:

```bash
export LLAMACPP_BASE_URL=http://127.0.0.1:8089/v1
export LLAMACPP_MODEL=laguna-xs-2.1-q4_k_m
export LLAMACPP_API_KEY='<private backend key>'
```

Use an authenticated llama.cpp Laguna XS instance. Background work (graph enrichment) only uses the model when it is already loaded. Loading it is an explicit user action: the Laguna/Graph header buttons acquire a fleet lease, which may stop another unleased resident model after confirmation. The lease is released after 20 idle minutes or when the server stops. No Ollama service or embedding model is needed. Remote clients use the app URL; backend credentials remain server-only. For Docker, loopback refers to the container: configure a reviewed local network arrangement before attempting host inference (or run the app as a native Node service).

### CLI

```bash
cd web/cli
npm ci
npm test
```

### Swift app

```bash
cd MarkdownNotes
swift test
```

## Validation

```bash
cd web
npm run check
npm test
npm run build
```

## Documentation

- [Architecture](docs/architecture.md)
- [Graph enrichment loop](docs/graph-enrichment-loop.md)
- [Development](docs/development.md)
- [Testing](docs/testing.md)
- [Security notes](docs/security.md)
- [Privacy](docs/privacy.md)
- [CLI](docs/cli.md)
- [Roadmap](docs/roadmap.md)
- [Web app details](web/README.md)

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

## Contributing and security

- See [CONTRIBUTING.md](CONTRIBUTING.md) for development and pull request guidance.
- See [SECURITY.md](SECURITY.md) for vulnerability reporting and local-first security notes.
- See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community expectations.
