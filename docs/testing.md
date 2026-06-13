# Testing

## Web app automated checks

```bash
cd web
npm run check
npm test
npm run build
```

`npm test` runs the Vitest suite. At the time this documentation was updated, the suite covers notes, chat/query streaming, memory retrieval, graph helpers, markdown rendering, wiki/maintenance workflows, and UI source assertions.

Useful targeted suites:

```bash
npm test -- --run src/lib/memory
npm test -- --run src/routes/api/query
npm test -- --run src/lib/vector/ragPipeline.streaming.test.ts
npm test -- --run src/lib/graph
npm test -- --run src/lib/wiki/query
npm test -- --run src/lib/components/ChatPanel.test.ts
```

## Manual chat/Ollama checks

Run Ollama and the web app:

```bash
ollama serve
ollama pull llama3.2:3b
ollama pull nomic-embed-text
cd web
npm run dev
```

Manual checklist:

- [ ] Create a note with a unique project/entity name and explicit facts.
- [ ] Open Chat from the nav or `/?chat=1`.
- [ ] Ask a question answerable from exact note text; verify a direct answer and note citation.
- [ ] Ask a question that requires reasoning from the note but is not covered by deterministic recall; verify the stream shows that Ollama is reasoning over relevant notes and returns a natural-language answer.
- [ ] Verify the answer does not expose raw graph-edge syntax such as `A --mentioned_in--> B`.
- [ ] Verify the chat footer shows memory coverage, e.g. `Memory evidence: 1 note · 3 graph edges`.
- [ ] Stop generation and verify the request cancels cleanly.

## Manual graph checks

- [ ] Create notes with links, tags, headings, Mermaid diagrams, and named entities.
- [ ] Open `/graph`.
- [ ] Verify nodes and relations appear.
- [ ] Select nodes/edges and verify detail/provenance is understandable.
- [ ] Treat review queue items as experimental; verify accepted/rejected state changes if using that surface.

## Experimental wiki checks

Only run these when validating the opt-in wiki/source subsystem:

```bash
npm test -- --run src/lib/wiki/ingest
npm test -- --run src/lib/wiki/query
npm test -- --run src/lib/wiki/lint
npm test -- --run src/lib/wiki/migration
```

Manual checklist:

- [ ] Import a raw source under the experimental wiki UI.
- [ ] Verify raw markdown appears under `raw/` unchanged.
- [ ] Verify generated wiki pages appear under `wiki/`.
- [ ] Ask chat with experimental wiki context enabled and verify wiki citations.
- [ ] File a cited answer back to the wiki.
- [ ] Run wiki lint and verify findings render.

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

The web app may show bundle-size warnings and optional local ML/vector dependency warnings during builds. They do not fail current checks but should be reduced before a polished public release.
