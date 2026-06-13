# Manual UX Regression Checklist

This checklist reflects the current note-first MarkdownNotes web app. The experimental wiki/source workflow is still present but is not the default user journey.

## 1. First-run and auth

- [ ] Visit the app unauthenticated and confirm redirect to `/login`.
- [ ] Create a local account.
- [ ] Confirm the app lands on the notes workspace.
- [ ] Confirm no protected app health checks spam visible login errors.
- [ ] Sign out and sign back in.

## 2. Notes workspace

- [ ] Create a new note.
- [ ] Edit markdown and verify save status.
- [ ] Reload and verify content persists.
- [ ] Render headings, lists, tables, code blocks, links, images, and Mermaid diagrams.
- [ ] Use folders/sidebar navigation.
- [ ] Search/select notes.
- [ ] Verify empty states are note-first, not source-ingestion-first.

## 3. Chat: notes + graph memory

Prerequisite: `ollama serve` is running for local-model fallback checks.

- [ ] Open Chat from the nav.
- [ ] Open Chat using `/?chat=1`.
- [ ] Ask an exact factual question about a note.
- [ ] Verify the answer is direct and grounded.
- [ ] Ask a reasoning question that forces Ollama fallback.
- [ ] Verify the response streams and does not hang silently.
- [ ] Verify memory coverage displays as `Memory evidence: N note(s) · M graph edge(s)`.
- [ ] Verify source chips cite notes/graph evidence.
- [ ] Verify the answer does not contain raw edge syntax such as `--mentioned_in-->`.
- [ ] Stop generation and verify the UI recovers.
- [ ] Clear chat and verify transient placeholders do not reappear as history.

Regression example:

```text
regarding blue heron recall sync, Which feature was marked as a future enhancement instead of part of the current sprint?
```

Expected behavior: answer from the note text in natural language. Graph links may be displayed as supporting evidence, but not as the answer.

## 4. Knowledge graph

- [ ] Create notes with entities, tags, links, folders, and Mermaid diagrams.
- [ ] Open `/graph`.
- [ ] Verify nodes/edges render.
- [ ] Select nodes/edges and verify detail/provenance is understandable.
- [ ] Verify graph evidence helps chat find related notes.
- [ ] If using the review queue, verify accept/reject actions work and are understandable.

UX expectation: the review queue is experimental/advanced. The primary graph UX should be exploration and evidence, not mandatory review.

## 5. Skills

- [ ] Open the skills UI.
- [ ] Generate or export a skill from selected graph/note context.
- [ ] Verify output is markdown and grounded in evidence.
- [ ] Verify weak evidence is disclosed rather than hidden.

## 6. Experimental wiki/source workflow

Only validate when intentionally testing experimental wiki features.

- [ ] Open experimental wiki/source UI.
- [ ] Import a raw source.
- [ ] Verify raw source file is preserved unchanged.
- [ ] Verify generated wiki pages/index/log update.
- [ ] Ask chat with `Use experimental wiki context` enabled.
- [ ] Verify wiki/raw citations and coverage labels.
- [ ] File a cited answer to the wiki.
- [ ] Run wiki lint and verify findings render.
- [ ] Run note-to-source migration twice and verify idempotency.

## 7. Privacy/security

- [ ] Confirm runtime data is under `MARKDOWN_NOTES_DATA_DIR` or `web/data`.
- [ ] Confirm private data is not staged in git.
- [ ] Verify non-loopback Ollama URLs are rejected.
- [ ] Verify screenshots/logs used for reports contain no private notes.

## 8. Automated checks before handoff

```bash
cd web
npm run check
npm test
npm run build
```
