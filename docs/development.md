# Development

## Prerequisites

- Node.js 22+
- npm
- Swift 5.9+ and macOS 14+ for the native app
- Optional: Ollama for local LLM workflows
- Optional: Google Chrome/Playwright for manual browser QA

## Convenience commands

From the repository root:

```bash
make setup
make check
```

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

Run with a temporary data directory when testing changes that create users/notes:

```bash
MARKDOWN_NOTES_DATA_DIR=$(mktemp -d /tmp/mdnotes-data.XXXXXX) npm run dev
```

## Ollama/local model development

```bash
ollama serve
ollama pull llama3.2:3b
ollama pull nomic-embed-text
```

The app only accepts loopback Ollama URLs by default.

## Manual browser QA

The project does not currently keep Playwright as a checked-in dependency, but ad hoc QA can use a temporary install outside the repo:

```bash
mkdir -p /tmp/pw-run
cd /tmp/pw-run
npm init -y
npm install playwright --no-save
```

Start the app from `web/`, then run a Playwright script from `/tmp/pw-run` against the local URL. Keep generated scripts, screenshots, and test data out of git unless they are intentionally sanitized and added as tests/docs.

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

Do not commit local data, SQLite databases, TLS certificates, `.env` files, screenshots with private content, or private notes.
