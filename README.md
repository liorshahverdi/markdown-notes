# Markdown Notes

This repository contains two related Markdown notes applications that are being prepared for open source release.

## Repository map

```text
.
├── web/             # SvelteKit + TypeScript local wiki/web app
│   ├── src/         # Application routes, UI components, stores, server helpers, wiki/RAG logic
│   ├── cli/         # TypeScript command-line client for the web app
│   ├── docs/        # Product plans, QA notes, and implementation reviews
│   └── scripts/     # Utility and migration scripts
├── MarkdownNotes/   # Native Swift/macOS Markdown notes app
│   ├── Sources/     # Swift app source code
│   ├── Tests/       # Swift package tests
│   └── scripts/     # macOS bundling/icon helper scripts
└── README.md        # Top-level project overview and repository map
```

## Current status

This project is in pre-open-source preparation. Release packaging and production hardening are still being finalized.

## Quickstart

### Web app

```bash
cd web
npm ci
npm run dev
```

The web app defaults to `./data` for local runtime state. Set `MARKDOWN_NOTES_DATA_DIR` to use another location.

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

## Documentation

- [Architecture](docs/architecture.md)
- [Development](docs/development.md)
- [Testing](docs/testing.md)
- [Security notes](docs/security.md)
- [Privacy](docs/privacy.md)
- [CLI](docs/cli.md)
- [Roadmap](docs/roadmap.md)

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

## Contributing and security

- See [CONTRIBUTING.md](CONTRIBUTING.md) for development and pull request guidance.
- See [SECURITY.md](SECURITY.md) for vulnerability reporting and local-first security notes.
- See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community expectations.
