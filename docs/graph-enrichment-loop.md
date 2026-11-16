# Knowledge-graph enrichment loop

The server owns the knowledge graph. The browser only displays it and forwards review actions.

## Layers

| Layer | Source | Lifetime |
|---|---|---|
| Base graph | `buildBaseGraph` (regex, diagram and folder extraction) over the current notes | Recomputed on every read, so edits and deletions shrink it |
| Overlay | `graph_overlay_relations`, `graph_entity_aliases`, `graph_entity_overrides`, `graph_custom_entities` | Each row belongs to one proposal; undo deletes that proposal's rows |
| Reviews | `graph_relation_reviews` (base edges, keyed by name) and `graph_proposals.reviewOutcome` | Permanent |
| Usage | `graph_edge_usage` (cited / helpful counts) | Drives decay and boosts |

`materializeGraph` (`src/lib/server/graph/materialize.ts`) combines these layers:
- applies merges, type overrides and model-found entities;
- drops self-loops and duplicate edges;
- prunes automatic edges whose evidence is gone;
- applies reviews and usage-based weight.

`getUserGraph` caches the result per user, keyed by note content and the overlay revision. `/api/graph`, `/api/query` (chat) and `/api/skills` all read this graph.

## Pass (`runGraphPass`, `src/lib/server/graph/graphWorker.ts`)

1. Detect changed notes with a content hash in `graph_note_state`.
2. **Co-occurrence**: normalized PMI over entities that are not notes, folders or dates. Already-related and already-proposed pairs are filtered out *before* the limit.
3. **Duplicates**:
   - same type only, never notes or folders;
   - names must match after normalization, or be close by edit distance with identical numbers;
   - Laguna must confirm before an auto-merge.
4. **Model stages** run on changed notes first, within a budget per pass:
   - **Implicit relations**: only entities from this note are sent, names must match exactly, the model must quote evidence that is checked against the note, and the real relation type is stored.
   - **Type checks**: corrections always go to review.
   - **Missed entities**: the name must appear word for word in the note.
   - Each note and stage is marked done even with zero results. After 3 failed attempts on the same content, the note is skipped until it changes.
5. **Auto-apply** when confidence is at or above the calibrated per-source threshold (`calibrateThreshold`):
   - fewer than 5 reviews: use the base threshold;
   - under 50% accepted: review only;
   - 50–70% accepted: base + 0.1;
   - 90% or more accepted over at least 10 reviews: base − 0.1.

   Model-found entities stay review-only until 5 reviews exist. Type corrections and transitive edges are always review-only.
6. **Regression check**: compute recall@k and MRR on `graph_eval_queries` before and after the auto-applies. If either gets worse, revert this pass's auto-applies back to pending.
7. Record the stats, eval result and quality metrics in `graph_runs`.

Every proposal has a stable `dedupeKey` (UNIQUE), so rejected or undone items are never proposed again, even after `POST /api/graph/rebuild`.

## Triggers

- `POST /api/notes`, note deletes and folder changes call `enqueueGraphUpdate`, which debounces per user (default 15 s).
- `startGraphScheduler()` in `hooks.server.ts` runs a pass for every user each hour, starting one minute after boot.
- `POST /api/graph/enrich` runs a pass now; `POST /api/graph/rebuild` resets note state and re-processes everything.
- Passes run one at a time across the process. Model stages only run when `checkLlamaCppHealth()` reports Laguna is already resident; the loop never activates a model.

## Feedback

- `/api/query` records `useCount` for every graph edge it cites.
- When the chat UI opens a cited source, it calls `POST /api/graph/feedback`. That credits the edges (`helpfulCount`) and adds `(question → note)` to the eval set.
- Unreviewed automatic edges that are never used decay after 30 days (down to 25% at least); helpful edges get a boost.

## UX surfaces

- **Header pill** (`GraphStatusPill`, `GET /api/graph/status`): pending review count, notes queued for model stages, running state. When the last pass skipped the model, it offers to start Laguna. `POST /api/llm/lease` queues a `model-ready` pass once the lease is held.
- **In-note suggestions** (`NoteSuggestions`, `GET /api/graph/proposals?noteId=&status=pending`): proposals made from the note or citing it in provenance. Hovering highlights the quote in the preview via the CSS Custom Highlight API (`::highlight(graph-evidence)`).
- **Chat citations** (`CitationChip`, `AnswerFeedback`): graph-edge citations carry `fromName/toName/reviewState` and the quote. 👍 credits the cited edges and adds an eval query; 👎 sets `unhelpfulCount`, which lowers non-accepted edges by 0.1 each (at most 0.3).

## Retrieval

`graphEdgeQuality` multiplies four factors: review status (accepted > base > auto), edge type, confidence/weight, and whether the edge has provenance. Pending and ephemeral edges are never used. Automatic edges are labeled `[unreviewed model suggestion]` in the prompt.

## API

| Route | Purpose |
|---|---|
| `GET /api/graph?includePending=1&includeRejected=1` | Materialized graph |
| `GET/POST /api/graph/proposals` | List proposals; create a user relation (e.g. accept a transitive suggestion) |
| `POST /api/graph/proposals/:id` `{action: accept\|reject\|undo}` | Review a proposal |
| `POST /api/graph/reviews` `{relationId, action: accept\|reject\|retype, type?}` | Review any edge |
| `GET/POST /api/graph/enrich` | Loop status (runs, metrics, thresholds) / run a pass now |
| `POST /api/graph/rebuild` | Re-process all notes, keeping reviews |
| `GET /api/graph/transitive?entityId=` | Multi-hop suggestions (built only from explicit or accepted edges; not stored) |
| `POST /api/graph/feedback` | Answer feedback |
| `GET/POST/DELETE /api/graph/eval` | Saved questions and the current retrieval score |

## Environment

| Variable | Default | |
|---|---|---|
| `GRAPH_ENRICH_ENABLED` | on | `0` disables background passes |
| `GRAPH_ENRICH_INTERVAL_MINUTES` | 60 | `0` disables the scheduler |
| `GRAPH_ENRICH_DEBOUNCE_MS` | 15000 | Delay after a note change |
| `GRAPH_ENRICH_LLM` | on | `0` skips the model stages |
| `GRAPH_ENRICH_LLM_NOTES_PER_PASS` | 5 (10 for manual runs) | Model budget per pass |
| `GRAPH_AUTO_APPLY_THRESHOLD` | unset | Can only make auto-apply stricter |

## Known limits

- Embedding similarity for duplicates is not used, because the app disables embeddings (`serverEmbeddings.ts`). Laguna confirmation replaces it.
- The regression check reverts a whole pass; it does not find the single change that caused the drop.
- The base regex extractor has pre-existing noise: headings identical to the note title become duplicate topic entities, and sentence fragments get extracted as Events. The loop surfaces some of these for review but does not fix the extractor.
