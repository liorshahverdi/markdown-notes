# Testing

## Web app

```bash
cd web
npm run check
npm test
npm run build
npm audit
```

## CLI

```bash
cd web/cli
npm test
npm audit
```

## Swift app

```bash
cd MarkdownNotes
swift test
```

## Current known warnings

The web app currently has Svelte accessibility warnings and bundle-size warnings. They do not fail the current checks, but should be reduced before a polished public release.
