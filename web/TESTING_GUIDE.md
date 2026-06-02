# MarkdownNotes Testing Guide

This guide focuses on the current product direction: an LLM-maintained local wiki backed by immutable raw sources, generated markdown wiki pages, wiki-first query, answer filing, wiki lint, and legacy note migration.

---

## 1. Automated test suite

Use Node.js 22+ for the web app.

```bash
cd web
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx vitest run
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run check
```

Useful targeted commands:

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx vitest run src/lib/server/vaultPaths.test.ts src/lib/server/vaultFrontmatter.test.ts src/lib/server/vaultFs.test.ts
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx vitest run src/lib/wiki/ingest
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx vitest run src/lib/wiki/query
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx vitest run src/lib/wiki/lint
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx vitest run src/lib/wiki/migration
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx vitest run src/lib/wiki/docs src/lib/wiki/schema
```

If native modules were built with the wrong Node version:

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm rebuild better-sqlite3
```

---

## 2. Local LLM Wiki Workflows

### 2.1 Import a raw source

Automated coverage:

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx vitest run src/lib/wiki/ingest/sourceImporter.test.ts src/lib/wiki/ingest/sourceSummarizer.test.ts src/lib/wiki/ingest/wikiIntegrator.test.ts
```

Manual checklist:

- [ ] Open the dashboard source import panel.
- [ ] Import a markdown source with a clear title.
- [ ] Verify a `raw_sources` row exists.
- [ ] Verify the raw markdown file appears under `data/vaults/<user-id>/raw/`.
- [ ] Verify the raw file content matches the submitted content.
- [ ] Verify a source-summary page appears under `data/vaults/<user-id>/wiki/sources/`.
- [ ] Verify relevant entity or concept pages are created when deterministic suggestions are available.
- [ ] Verify `wiki/index.md` updates.
- [ ] Verify `wiki/log.md` receives a structured ingest entry.

### 2.2 Verify wiki-first query citations

Automated coverage:

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx vitest run src/lib/wiki/query/wikiSearch.test.ts src/lib/wiki/query/wikiAnswerBuilder.test.ts src/lib/wiki/query/queryPipeline.test.ts src/lib/components/ChatPanelCitations.test.ts
```

Manual checklist:

- [ ] Ask a question answerable from an existing wiki page.
- [ ] Verify the response cites wiki pages first.
- [ ] Verify the UI shows wiki citation kind and coverage state.
- [ ] Ask a question with weak wiki coverage but relevant raw source text.
- [ ] Verify raw-source fallback is explicit.
- [ ] Verify the response still includes citation metadata.

### 2.3 File an answer back to the wiki

Automated coverage:

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx vitest run src/lib/wiki/query/answerClassifier.test.ts src/lib/wiki/query/answerToPage.test.ts src/lib/wiki/query/fileAnswerWorkflow.test.ts src/lib/components/FileAnswerPanel.test.ts src/lib/components/ChatPanelFileAnswer.test.ts
```

Manual checklist:

- [ ] Ask a question that returns a substantive cited answer.
- [ ] Click “File answer to wiki”.
- [ ] Verify a question page appears under `wiki/questions/`.
- [ ] Verify the question page contains the answer, filing context, and citations.
- [ ] Verify `wiki/index.md` includes the new question page.
- [ ] Verify `wiki/log.md` records the query filing.
- [ ] Verify insufficient or error answers are skipped with explicit reasons.

### 2.4 Run wiki lint

Automated coverage:

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx vitest run src/lib/wiki/lint src/lib/components/LintFindingsPanel.test.ts
```

Manual checklist:

- [ ] Open the Wiki Health panel.
- [ ] Refresh findings.
- [ ] Verify broken wiki links are reported as errors.
- [ ] Verify orphan pages are reported as warnings.
- [ ] Verify stale low-confidence/open-question pages are reported as warnings.
- [ ] Verify deterministic `Claim: key = true/false` conflicts are reported as contradictions.
- [ ] Verify every finding has severity, type, message, and action.

### 2.5 Migrate legacy notes

Automated coverage:

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx vitest run src/lib/wiki/migration/notesToSources.test.ts src/lib/components/LegacyMigrationPanel.test.ts
```

Manual checklist:

- [ ] Create or identify existing legacy notes.
- [ ] Click “Migrate legacy notes”.
- [ ] Verify the result reports migrated and skipped counts.
- [ ] Verify original legacy notes still exist.
- [ ] Verify each migrated note appears as a `note` raw source.
- [ ] Verify migrated raw source files match original note content byte-for-byte.
- [ ] Run migration a second time.
- [ ] Verify already migrated notes are skipped and not duplicated.

---

## 3. Schema documentation

Automated coverage:

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx vitest run src/lib/wiki/schema/schemaDocs.test.ts src/lib/wiki/docs/productDocs.test.ts
```

Manual checklist:

- [ ] Generate schema docs through `ensureWikiSchemaDocs` or a flow that calls it.
- [ ] Verify `schema/README.md` describes the LLM-maintained local wiki model.
- [ ] Verify `schema/raw-source.md` documents raw source fields and immutability.
- [ ] Verify `schema/wiki-page.md` documents page types and update reasons.
- [ ] Verify `schema/wiki-mutation.md` documents mutation trigger types.

---

## 4. Product acceptance checklist

A release candidate for the local wiki pivot is acceptable when all of the following pass:

1. Import a raw source.
2. Verify the raw file appears under `raw/` unchanged.
3. Verify a source-summary page appears under `wiki/sources/`.
4. Verify at least one related entity or concept page is created or updated.
5. Verify `wiki/index.md` updates.
6. Verify `wiki/log.md` gets a structured entry.
7. Ask a question answerable from the wiki.
8. Verify wiki-first query citations.
9. Ask a question the wiki cannot fully answer.
10. Verify raw-source fallback is explicit.
11. File an answer back to the wiki.
12. Run wiki lint and verify findings render in the UI.
13. Migrate legacy notes and verify no data loss.
14. Run migration again and verify idempotency.
15. Restart the app and verify the vault-backed artifacts remain readable.

---

## 5. Legacy feature regression checks

The pivot should not regress existing app foundations:

- [ ] Notes can still be created, edited, saved, searched, pinned, and deleted.
- [ ] Folder tree interactions still work.
- [ ] Authentication still protects routes.
- [ ] Ollama URL guardrails still reject non-loopback server requests.
- [ ] Existing voice/dictation controls degrade gracefully when browser APIs are unavailable.
- [ ] `npm run check` reports zero errors.

Warnings may remain temporarily if they are pre-existing and explicitly reported.
