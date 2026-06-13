# MarkdownNotes Web Testing Guide

This guide reflects the current note-first app state. Default chat is notes + graph memory. The source/wiki subsystem is experimental and opt-in.

## 1. Automated checks

Use Node.js 22+.

```bash
cd web
npm run check
npm test
npm run build
```

Targeted suites:

```bash
npm test -- --run src/lib/memory
npm test -- --run src/routes/api/query
npm test -- --run src/lib/vector/ragPipeline.streaming.test.ts
npm test -- --run src/lib/graph
npm test -- --run src/lib/components/ChatPanel.test.ts
npm test -- --run src/lib/wiki
```

If native modules were built with the wrong Node version:

```bash
npm rebuild better-sqlite3
```

---

## 2. Notes workflow checklist

- [ ] Sign up or sign in locally.
- [ ] Create a note.
- [ ] Edit and save markdown content.
- [ ] Verify save status resolves successfully.
- [ ] Reload the app and verify the note remains.
- [ ] Search/select notes from the sidebar.
- [ ] Move notes between folders if validating folder behavior.
- [ ] Insert/render Mermaid, tables, code blocks, links, and images where relevant.

---

## 3. Chat memory checklist

Prerequisite for local-model fallback:

```bash
ollama serve
ollama pull qwen2.5:3b
ollama pull nomic-embed-text
```

Manual checks:

- [ ] Create a note with a distinctive title and facts.
- [ ] Open Chat via the nav or `/?chat=1`.
- [ ] Ask a simple exact-fact question and verify a direct grounded answer.
- [ ] Ask a reasoning question that should require local model fallback.
- [ ] Verify the streamed response starts promptly and does not leave the UI blank.
- [ ] Verify the answer is natural language, not raw graph syntax.
- [ ] Verify memory coverage appears, e.g. `Memory evidence: 1 note · 2 graph edges`.
- [ ] Verify source chips point to relevant notes/graph evidence.
- [ ] Stop a long generation and verify the UI recovers.
- [ ] Toggle `Use experimental wiki context` only when intentionally testing wiki retrieval.

Known-good regression prompt shape:

```text
regarding <project/note name>, which feature/item/decision was marked ...?
```

Expected behavior: answer from note text first; graph links can support retrieval but must not become the answer.

---

## 4. Knowledge graph checklist

- [ ] Create notes with entities, tags, wikilinks, folders, and Mermaid diagrams.
- [ ] Open `/graph`.
- [ ] Verify graph nodes/edges are visible.
- [ ] Select graph nodes and verify the detail panel explains connected evidence.
- [ ] Select graph edges and verify the edge detail drawer shows provenance, confidence/weight, extraction method, and source-note links.
- [ ] Accept/reject a low-confidence or model-inferred edge and verify unrelated edges are not mutated; rejected edges should disappear from the normal graph view.
- [ ] Generate a skill from a selected edge and verify the draft is grounded in that edge's cited evidence.
- [ ] Verify graph links improve chat retrieval when a question references a connected note/entity.

UX note: edge selection is canvas-based; if validating manually, capture any discoverability/accessibility issues for follow-up.

---

## 5. Skills checklist

- [ ] Open the skills surface.
- [ ] Generate or export a skill from graph/note context.
- [ ] Verify generated skill markdown is grounded in selected evidence.
- [ ] Verify weak or missing evidence is surfaced clearly.

---

## 6. Experimental wiki/source checklist

Use only when validating the opt-in wiki subsystem.

Automated coverage:

```bash
npm test -- --run src/lib/wiki/ingest
npm test -- --run src/lib/wiki/query
npm test -- --run src/lib/wiki/lint
npm test -- --run src/lib/wiki/migration
```

Manual checks:

- [ ] Import a raw source.
- [ ] Verify a raw file appears under `data/vaults/<user-id>/raw/` unchanged.
- [ ] Verify generated wiki pages appear under `wiki/`.
- [ ] Verify `wiki/index.md` and `wiki/log.md` update.
- [ ] Ask with experimental wiki context enabled and verify wiki/raw citations.
- [ ] File a cited answer back to `wiki/questions/`.
- [ ] Run wiki lint and verify findings render.
- [ ] Run legacy note migration twice and verify idempotency.

---

## 7. Security/privacy checks

- [ ] Confirm private data remains under `MARKDOWN_NOTES_DATA_DIR`/`web/data`.
- [ ] Confirm local data is not staged for commit.
- [ ] Verify Ollama URLs reject non-loopback hosts.
- [ ] Verify unauthenticated `/api/*` requests return 401 except public auth endpoints.
- [ ] Avoid including private notes in screenshots, logs, issues, or pull requests.
