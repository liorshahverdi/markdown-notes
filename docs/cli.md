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

## Importing existing markdown

```bash
notes-cli import ~/notes                      # every .md/.markdown under a directory
notes-cli import ~/notes --dry-run            # list what would be imported, write nothing
notes-cli import CHANGELOG.md --split         # one note per top-level "##" section
notes-cli import ~/notes --prefix "archive/"  # prepend a prefix to every title
```

Import requires a token with the `notes:write` scope. `notes-cli login` requests read-only
scopes by default, so create a write-capable token explicitly:

```bash
notes-cli login --scopes notes:read,notes:write,query:read,graph:read,skills:read
```

Notes are written one at a time through the single-note API path rather than the bulk path,
because only the single-note path triggers summary generation and the local memory index —
bulk-written notes are invisible to graph and chat retrieval until they are touched again.

Each note is given a stable id derived from its source path and title, so re-running an import
updates the existing notes instead of creating duplicates.

`--max-words` (default 1500) further splits any note that is still too long after
heading-splitting, cutting on paragraph boundaries and suffixing the parts `(1/3)`,
`(2/3)` and so on. This matters for documents that mark their sections with bold text
rather than `##`, where heading-splitting finds nothing to cut — one such file imported
as a single 27,691-word note. Set `--max-words 0` to disable.

`--split` is worth using on long documents. A single very large note is a poor retrieval unit:
chunking is coarse and the whole document tends to come back as the answer to everything.
Splitting on `##` headings gives the index units that are about one thing. Headings inside
fenced code blocks are ignored, and any content before the first heading is kept as its own note
so nothing is dropped.

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
