# Architecture

Markdown Notes contains two related apps.

## Web app

The `web/` app is a local-first SvelteKit application. It stores application state in SQLite and managed Markdown vault files.

Core layers:

- Svelte routes and components in `web/src/routes` and `web/src/lib/components`.
- Server-only helpers in `web/src/lib/server`.
- Markdown/wiki workflows in `web/src/lib/wiki`.
- Optional graph, vector, voice, and skill tooling in `web/src/lib`.
- Local LLM integration through Ollama loopback URLs.

The web app defaults to `web/data` at runtime. Set `MARKDOWN_NOTES_DATA_DIR` to use another data directory.

## CLI

The CLI lives in `web/cli/` and talks to the web app API.

## Swift app

The native macOS app lives in `MarkdownNotes/` and is built as a Swift package. It contains SwiftUI views, note models, Markdown rendering/highlighting utilities, and XCTest coverage.
