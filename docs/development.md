# Development

## Prerequisites

- Node.js 22+
- npm
- Swift 5.9+ and macOS 14+ for the native app
- Optional: Ollama for local LLM workflows

## Web app

```bash
cd web
npm ci
npm run dev
```

Checks:

```bash
npm run check
npm test
npm run build
npm audit
```

## CLI

```bash
cd web/cli
npm ci
npm test
npm audit
```

## Swift app

```bash
cd MarkdownNotes
swift test
```

## Local data

The web app defaults to a local `data/` directory under `web/`. Override it with:

```bash
MARKDOWN_NOTES_DATA_DIR=/path/to/data npm run dev
```

Do not commit local data, SQLite databases, TLS certificates, `.env` files, or private notes.
