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

## JSON mode

Non-interactive commands support `--json` for scripts and future MCP adapters:

```bash
notes-cli status --json
notes-cli list --search "project" --json
notes-cli show "Note Title" --json
notes-cli ask "What did I decide?" --json
notes-cli graph stats --json
notes-cli graph entities --type topic --json
notes-cli skill list --json
notes-cli skill generate --notes note-id --json
notes-cli logout --json
```

Examples:

```bash
notes-cli list --json | jq '.notes[].title'
notes-cli ask "What changed in graph review?" --json | jq -r '.response'
MARKDOWN_NOTES_TOKEN=mnpat_... notes-cli graph stats --json
```

JSON errors are emitted to stderr with a stable shape and exit code `1`:

```json
{
  "ok": false,
  "error": {
    "message": "API error: 403 Forbidden: Forbidden",
    "code": "API_ERROR",
    "status": 403,
    "statusText": "Forbidden",
    "body": {
      "error": "Forbidden",
      "requiredScope": "notes:write"
    }
  }
}
```

Interactive `notes-cli chat` remains human-oriented and does not currently provide JSON streaming. If needed later, add a separate `--json-stream` mode rather than overloading `--json`.
