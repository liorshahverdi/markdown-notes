# Manual UX Regression Checklist

Use this checklist to manually verify the local LLM wiki pivot after the phase-series changes.

Project path:

```bash
cd <repo>/web
```

Use Node 22 for all commands:

```bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
```

## 0. Start the app

```bash
npm run dev
```

Open the app in your browser at the URL printed by Vite, usually:

```text
http://localhost:5173
```

If you want a clean manual run, back up or clear local app data first. If you want to test migration against existing real notes, do not clear data.

---

## 1. Existing note app regression

### 1.1 Create a normal note

Steps:

1. Click the new note action.
2. Add a title.
3. Add markdown content with headings, bold text, links, and a list.
4. Wait for save/persistence.
5. Refresh the browser.

Expected:

- The note still appears in the sidebar.
- The title is preserved.
- The markdown body is preserved.
- Selecting the note restores its content.

### 1.2 Edit an existing note

Steps:

1. Select an existing note.
2. Change the title.
3. Change the body.
4. Refresh the browser.

Expected:

- The changed title persists.
- The changed body persists.
- No duplicate note is created.

### 1.3 Sidebar and folder smoke test

Steps:

1. Create or use a folder if folder UI is available.
2. Move a note into or out of the folder.
3. Select notes from the sidebar.
4. Search/filter notes if search is visible.

Expected:

- Sidebar renders without errors.
- Note selection works.
- Folder expansion/collapse still works.
- Search/filter still works.

### 1.4 Preview smoke test

Steps:

1. Select a markdown note with headings, bold text, links, and lists.
2. Check the preview pane.
3. Select no note, or select an empty note.

Expected:

- Markdown preview renders correctly.
- Empty/blank preview state is reasonable.
- No console errors appear.

---

## 2. Source import workflow

Use the new Sources panel.

### 2.1 Import a markdown source

Input:

Title:

```text
Computing History
```

Type:

```text
note
```

Content:

```markdown
Ada Lovelace studied the Analytical Engine.
Ada Lovelace wrote notes about the Analytical Engine.
```

Steps:

1. Paste the title, type, and content into the source import form.
2. Submit/import the source.

Expected UI:

- Source appears in the source list.
- No error banner appears.
- Imported source title is visible.

Expected filesystem:

- A raw markdown file appears under:

```text
web/data/vaults/<user-id>/raw/
```

- The raw file content exactly matches what you pasted.

Expected wiki files:

- A source-summary page appears under:

```text
web/data/vaults/<user-id>/wiki/sources/
```

- The source-summary page has frontmatter.
- The page body is readable markdown.
- The slug includes the title plus a short unique suffix.

---

## 3. Cross-page ingest workflow

Run this after importing the `Computing History` source.

### 3.1 Check generated entity/concept pages

Inspect:

```text
web/data/vaults/<user-id>/wiki/entities/
web/data/vaults/<user-id>/wiki/concepts/
```

Expected:

- Entity pages like `ada-lovelace` and/or `analytical-engine` may be created depending on extraction.
- Generated pages should include source links/provenance.

### 3.2 Check wiki index

Open:

```text
web/data/vaults/<user-id>/wiki/index.md
```

Expected:

- Imported source summary is listed.
- Entity/concept pages are listed if created.
- Links use wiki-style references.

### 3.3 Check wiki log

Open:

```text
web/data/vaults/<user-id>/wiki/log.md
```

Expected:

- A new ingest entry exists.
- Source ID is present.
- Changed page IDs are present.
- Entry is structured and readable.

### 3.4 Check in-app panels

Expected:

- Wiki Index panel displays index content.
- Wiki Log panel displays log content.
- Ingest Review panel shows latest mutation details.

---

## 4. Wiki-first chat/query workflow

Prerequisite:

- Ollama/local model route must be healthy enough for chat.
- If the app has an Ollama status indicator, verify it is healthy.

### 4.1 Ask a wiki-answerable question

Prompt:

```text
What did Ada Lovelace study?
```

Expected:

- Chat sends successfully.
- Answer appears.
- Citations are shown.
- Citations prefer wiki pages when wiki coverage is good.
- Coverage state indicates wiki-backed coverage or similar.

### 4.2 Ask a weakly covered question

Prompt:

```text
What did Ada Lovelace say about quantum computing?
```

Expected:

- Answer should say coverage is weak/insufficient, or use fallback explicitly.
- Raw-source fallback should be visible/explicit if used.
- The app should not present unsupported claims as fully grounded.

---

## 5. Answer filing workflow

Run this after receiving a chat answer with citations.

Steps:

1. Look for the file-answer/save-to-wiki action in the assistant response.
2. Trigger it.
3. Confirm/review if the UI asks for confirmation.

Expected UI:

- Filing succeeds without error.
- A success state or updated panel appears.

Expected filesystem:

- A new or updated wiki page appears under:

```text
web/data/vaults/<user-id>/wiki/
```

Expected content:

- The filed answer is present.
- Citation/provenance details are present.
- Page is valid markdown.

Follow-up:

1. Ask a related question again.

Expected:

- Newly filed wiki content can be found/cited.

---

## 6. Wiki lint/health workflow

### 6.1 Run normal lint

Steps:

1. Use the Lint Findings panel.
2. Trigger refresh/run lint.

Expected:

- Panel loads without error.
- It either reports no findings or lists actionable findings.
- Each finding should have:
  - severity
  - type
  - message
  - suggested action

### 6.2 Optional broken-link test

Steps:

1. Manually add a broken wiki link to a wiki markdown file:

```markdown
[[missing/page]]
```

2. Run lint again.

Expected:

- A broken-link finding appears.

Cleanup:

1. Remove the intentionally broken link.
2. Run lint again.

Expected:

- The broken-link finding disappears.

---

## 7. Legacy note migration workflow

Use existing notes or create 2-3 notes first.

### 7.1 First migration

Steps:

1. In the Legacy Migration panel, click migrate legacy notes.

Expected:

- UI shows total/migrated/skipped counts.
- No error appears.

Expected raw sources:

- For each migrated note, a raw source exists under:

```text
web/data/vaults/<user-id>/raw/
```

- Raw source content matches the original note content exactly.

Expected metadata:

Migrated sources should include tags like:

```text
legacy-note
legacy-note:<note-id>
folder:<folder-id>
pinned
shared
```

Some tags only appear when applicable.

### 7.2 Idempotency check

Steps:

1. Click migrate again.

Expected:

- Migrated count should be 0 or lower than the first run.
- Skipped count should include already migrated notes.
- No duplicate raw sources are created for the same legacy note.

### 7.3 Legacy mode preservation

Expected:

- Original notes are still visible in the old note UI.
- Original notes are still editable.
- Migration does not delete legacy notes.

---

## 8. Restart and persistence test

Steps:

1. Stop the dev server.
2. Start it again:

```bash
npm run dev
```

3. Refresh the browser.

Expected:

- Notes still load.
- Sources still load.
- Wiki index/log still render.
- Chat panel still renders.
- Migration panel still renders.
- Lint panel still renders.
- Previously generated vault files are still present.

---

## 9. API smoke tests

With the dev server running, run:

```bash
curl -s http://localhost:5173/api/sources | jq
curl -s http://localhost:5173/api/wiki/index | jq
curl -s http://localhost:5173/api/wiki/log | jq
curl -s http://localhost:5173/api/wiki/mutations/latest | jq
curl -s http://localhost:5173/api/wiki/lint | jq
```

Expected:

- Each command returns valid JSON.
- No endpoint returns a 500.
- Wiki endpoints reflect the current user context.

Optional query smoke test:

```bash
curl -s http://localhost:5173/api/query \
  -H 'content-type: application/json' \
  -d '{"question":"What did Ada Lovelace study?"}' | jq
```

Expected:

- Valid JSON response.
- Answer field present.
- Citation/coverage fields present if the local model/query pipeline is available.

---

## 10. Final local verification commands

Before considering the branch accepted locally, run:

```bash
cd <repo>/web
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"

npx vitest run
npm run check
npm run build
```

Expected at time of writing:

- Vitest: `90` files / `655` tests passing.
- Check: `0` errors, known warnings only.
- Build: passes.

Known non-blocking warnings at time of writing:

- Existing Svelte accessibility warnings in modal/sidebar/settings components.
- Existing `<svelte:self>` deprecation warning.
- Large bundle/chunk warnings.
- `onnxruntime-web` eval warning from dependency.
- `adapter-auto` production environment warning.

---

## Recommended manual test order

Run the checklist in this order for best coverage:

1. Existing note create/edit regression.
2. Source import.
3. Check raw/wiki/index/log files.
4. Chat wiki-first answer.
5. File answer back to wiki.
6. Lint panel.
7. Legacy migration twice for idempotency.
8. Restart and verify persistence.
9. API smoke tests.
10. Final local verification commands.

This sequence exercises the full pivot loop:

```text
legacy notes -> raw sources -> generated wiki -> query -> filed answer -> lint/health -> persistence
```
