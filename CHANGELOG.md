# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project intends to follow semantic versioning after the first public release.

## [Unreleased]

### Added

- Initial open-source preparation files.
- Repository scope now includes both the SvelteKit web app and native Swift/macOS app.
- Persisted graph edge review state so rejected edges are excluded from normal graph and chat retrieval.
- Local API token support for CLI, automation, and future MCP adapters, including scoped bearer-token auth and `/api/tokens` management.

### Changed

- Normal note saves no longer sync notes into the experimental wiki/source subsystem.
- CLI commands can use saved local API tokens from `~/.markdown-notes/config.json` or `MARKDOWN_NOTES_TOKEN`.
- CLI non-interactive commands now support `--json` for scripting and future MCP adapters.
