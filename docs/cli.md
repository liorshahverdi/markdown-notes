# CLI

The CLI package lives in `web/cli/`.

```bash
cd web/cli
npm ci
npm test
```

The package exposes a `notes-cli` binary for interacting with the Markdown Notes web app API. Start the web app first, then use the CLI commands in `web/cli/src/commands`.

## Authentication

The web app supports local API tokens for CLI and future MCP integrations. Browser users still authenticate with the normal session cookie; CLI requests use:

```http
Authorization: Bearer mnpat_...
```

Create and store a CLI token:

```bash
notes-cli login --url http://localhost:5173 --username <user>
```

The command logs in with the local username/password, creates an API token through `/api/tokens`, stores only the token in `~/.markdown-notes/config.json`, and discards the temporary session cookie.

Configuration can also come from environment variables:

```bash
export MARKDOWN_NOTES_URL=http://localhost:5173
export MARKDOWN_NOTES_TOKEN=mnpat_...
notes-cli list
```

Remove the stored token:

```bash
notes-cli logout
```

The config file is written with user-only permissions (`0600`). Treat it as a local secret and do not commit or paste it into issues/logs.

## Common commands

```bash
notes-cli status
notes-cli list --search "project"
notes-cli show "Note Title"
notes-cli ask "What did I decide about graph review?"
notes-cli graph stats
notes-cli graph entities --type topic
notes-cli skill list
```

Most commands accept `--url` and `--token` to override the saved config for one invocation.
