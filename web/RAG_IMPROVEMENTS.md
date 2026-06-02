# RAG System Improvements

Targeted improvements to the existing local RAG system.

---

## Completed: Prompt Construction & Excerpt Extraction Overhaul

**Problem**: Large notes (>12k chars) were truncated from the top, losing content in later sections. Queries about specific people in transcripts or broad summary requests failed because relevant content was cut.

**Changes** (in `src/lib/vector/ragPipeline.ts` and `src/routes/api/query/+server.ts`):

1. **Increased `MAX_PROMPT_CHARS` from 12,000 to 32,000** — llama3.2:3b supports 128k context tokens, so the old limit was unnecessarily restrictive.

2. **Section-aware excerpt extraction** — `extractRelevantExcerpt` now splits notes by markdown headers (not just paragraphs) and scores each section by query term matches, with 2x bonus for header matches. This ensures the right sections are prioritized.

3. **Paragraph-level extraction within sections** — When a section is too large, `extractParagraphsFromSection` scores individual paragraphs by query terms and keeps the highest-scoring ones. This prevents a person's quotes from being lost just because they appear late in a transcript.

4. **Broad vs focused query detection** — `isBroadQuery()` detects summary-type queries ("summarize", "overview", "everyone", etc.) and switches to even paragraph sampling across sections for coverage of all speakers/topics, rather than term-frequency scoring that drops unmatched paragraphs.

5. **Relevance-weighted note budgets** — `buildRAGPrompt` receives relevance scores from search and allocates more character budget to higher-scored notes proportionally, rather than splitting evenly.

6. **Reversed note order (lost-in-the-middle fix)** — Highest-relevance notes are placed last in the prompt, closest to the instruction, to combat LLM attention bias that underweights middle content.

7. **Knowledge graph re-indexing on folder move** — `moveNoteToFolder` now calls `extractAndSaveEntities` (via dynamic import) after persisting the move, so graph entities/relations update with the new folder context.

---

## Completed: Sidebar Folder Tree View

**Problem**: Flat "navigate into folder" model with breadcrumbs required clicking into each folder to see contents.

**Changes** (in `src/lib/stores/folders.ts`, `src/lib/components/SidebarFolderItem.svelte`, `src/lib/components/Sidebar.svelte`):

1. **Expandable tree** — `SidebarFolderItem` is now recursive, accepting `FolderTreeNode` (which includes `children` and `notes`) with depth-based indentation and expand/collapse chevrons.

2. **Inline notes** — Notes appear nested under their parent folder in the tree when expanded, not in a separate list below.

3. **Auto-expand on load** — `loadFolders` initializes `expandedFolderIds` with all folder IDs so the full tree is visible immediately.

4. **Store helpers** — Added `toggleFolderExpanded`, `expandFolder`, `rootNotes`, and enriched `FolderTreeNode` with `notes: NoteRecord[]`.

---

## Remaining Improvements

## 1. Persist Embeddings to IndexedDB

**Problem**: Vectors live only in memory. Every page reload re-embeds all notes — slow cold starts, wasted compute.

**Current state**: The `embeddings` table in IndexedDB stores only `id` and `textHash` (content fingerprints), not actual vectors. `vectorStore.ts` holds a plain `VectorEntry[]` array in memory.

**Fix**:
- Extend the `embeddings` IndexedDB table to store `vector: number[]` alongside `textHash`
- On init, load persisted vectors into the in-memory `VectorStore` — skip embedding for notes whose `textHash` hasn't changed
- On embed, write vectors to IndexedDB alongside the existing hash check
- Bump Dexie schema version

**Files**:
- `src/lib/db/index.ts` — add `vector` field to embeddings table schema
- `src/lib/vector/vectorStoreManager.ts` — load from DB on init, save after embedding
- `src/lib/vector/vectorStore.ts` — accept pre-built entries on init

---

## 2. Add Chunk Overlap

**Problem**: 2000-char chunks with zero overlap lose context at boundaries. A sentence split across two chunks may not be retrievable by either.

**Current state**: `vectorStore.ts:chunkText()` splits on paragraph boundaries sequentially, no sliding window.

**Fix**:
- Add ~200 char overlap between consecutive chunks (roughly 10% of chunk size)
- When accumulating paragraphs, carry the last paragraph of the previous chunk into the next
- Keep chunk IDs stable (noteId_chunkIndex) — overlap doesn't change identity

**Files**:
- `src/lib/vector/vectorStore.ts` — modify `chunkText()` to carry overlap

---

## 3. Integrate Knowledge Graph into Retrieval

**Problem**: Entity extraction and relationship discovery exist but are completely isolated from RAG retrieval. The graph is built and visualized but never queried during search.

**Current state**: `entityExtractor.ts` extracts entities (topics, tags, links). `relationshipDiscoverer.ts` finds co-occurring entity pairs. Neither is referenced in `ChatPanel.svelte` or `ragPipeline.ts`.

**Fix**:
- After vector search returns top-K results, use the knowledge graph to expand the result set:
  1. Extract entities from the query (simple keyword match against known entities)
  2. Find notes connected to those entities via relations
  3. Boost scores of notes that are graph-connected to top vector results
  4. Add graph-only results (not in vector top-K) with a lower base score
- This is a **re-ranking + expansion** step, not a replacement for vector search

**Files**:
- `src/lib/graph/graphRetriever.ts` — new file, graph-based retrieval logic
- `src/lib/components/ChatPanel.svelte` — integrate graph results into retrieval pipeline
- `src/lib/db/index.ts` — may need indexed queries on entity names

---

## 4. ~~Share Vector Store with Server API Endpoint~~ ✅ DONE

Server-side semantic search is implemented in `src/lib/vector/serverEmbeddings.ts` using `@xenova/transformers` (all-MiniLM-L6-v2). The `/api/query` endpoint uses it with in-memory embedding cache keyed by note ID + content length.

---

## 5. Add Cross-Encoder Reranking

**Problem**: Cosine similarity between query and chunk embeddings is a weak relevance signal. Bi-encoder embeddings are optimized for speed, not precision.

**Current state**: Results ranked purely by cosine similarity + a heuristic title-match bonus.

**Fix**:
- After initial retrieval (vector + graph), run a lightweight cross-encoder reranker on the top candidates
- Use `Xenova/ms-marco-MiniLM-L-6-v2` (cross-encoder, runs in browser via transformers.js)
- Score each (query, chunk) pair, re-sort by cross-encoder score
- Apply only to top ~10-15 candidates to keep latency reasonable

**Files**:
- `src/lib/vector/reranker.worker.ts` — new Web Worker for cross-encoder inference
- `src/lib/vector/vectorStoreManager.ts` — add rerank step after search
- `src/lib/components/ChatPanel.svelte` — wire reranker into retrieval flow

---

## Implementation Order

1. **Persist embeddings** — eliminates cold start, prerequisite for #4
2. **Chunk overlap** — small change, immediate retrieval quality gain
3. **Graph retrieval** — leverages existing unused infrastructure
4. ~~**Server-side semantic search**~~ — ✅ Done (server uses `@xenova/transformers` via `serverEmbeddings.ts`)
5. **Reranking** — final quality layer, highest complexity
