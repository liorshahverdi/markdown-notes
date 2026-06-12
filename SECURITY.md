# Security Policy

## Supported versions

This project is in pre-1.0 development. Security fixes are handled on the main branch until a formal release policy is established.

## Reporting a vulnerability

Please do not open a public issue for suspected vulnerabilities.

Until a dedicated security contact is published, report issues privately to the project maintainer through the repository owner's preferred private contact channel. Include:

- affected component (`web`, `web/cli`, or `MarkdownNotes`);
- steps to reproduce;
- impact and expected severity;
- any relevant logs, screenshots, or proof-of-concept details.

## Security model notes

Markdown Notes is currently local-first software. The web app stores user data under a local `data/` directory and can proxy requests to a local Ollama server. Treat production or multi-user deployment as experimental unless explicitly documented otherwise.

Never commit private notes, local database files, TLS certificates, model credentials, or `.env` files.
