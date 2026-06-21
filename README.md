# Markdown Notes

Markdown Notes is a local-first markdown notes workspace with graph-powered memory and optional local-model assistance through Ollama.

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
- Ollama is used only when deterministic memory recall is insufficient
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

Optional local model setup:

```bash
ollama serve
ollama pull llama3.2:3b
ollama pull nomic-embed-text
```

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
