# Contributing

Thanks for helping improve Markdown Notes.

## Project layout

- `web/` contains the SvelteKit local wiki/web app.
- `web/cli/` contains the TypeScript CLI client.
- `MarkdownNotes/` contains the native Swift/macOS app.

## Development checks

Before opening a pull request, run the checks that match the area you changed.

### Web app

```bash
cd web
npm ci
npm run check
npx vitest run
npm run build
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

## Pull requests

Please include:

- a short summary of the change;
- tests or a reason tests are not applicable;
- screenshots/GIFs for UI changes;
- notes about data migration, security, or privacy impact when relevant.

## Local data and secrets

Do not commit local vault data, SQLite databases, TLS certificates, `.env` files, or private notes. The repository ignore rules should exclude common local artifacts, but please verify with `git status` before committing.
