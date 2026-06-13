# RAG and Chat Memory Improvements

This document reflects the current note-first RAG/chat path.

## Current architecture

Default chat uses notes + graph memory through `POST /api/query`.

Pipeline summary:

1. Load authenticated user's notes and folders.
2. For streaming chat, open an NDJSON response immediately so the UI is never blank while retrieval/model work runs.
3. Retrieve context with lexical/title matching and persisted local memory chunks.
4. Expand context with graph evidence.
5. Return deterministic high-confidence synthesized answers only for narrow safe cases.
6. Otherwise build an Ollama chat prompt with note text first and graph links as supporting/navigation context.
7. Stream Ollama tokens into one assistant message.

Important current rule: graph links help retrieval and context, but note text must answer factual questions. Raw graph syntax must not appear as the answer.

## Completed improvements

### Streaming and UI responsiveness

- `/api/query` supports streaming NDJSON responses.
- The server emits an immediate `Searching your notes and graph…` status for interactive chat.
- The server emits `I found relevant notes. Asking Ollama to reason over them…` only when it actually falls through to Ollama.
- Abort signals are passed through to local model calls.
- `ChatPanel.svelte` immutably updates the active assistant message so Svelte 5 renders streamed tokens reliably.

### Prompt construction

- `MAX_PROMPT_CHARS` is now large enough for substantial note context.
- Excerpt extraction is section-aware and paragraph-aware.
- Broad query detection uses broader sampling.
- Higher-relevance notes are placed close to the final answer instruction.
- Note text is placed before graph context.
- Graph context is labeled as supporting/navigation context only.
- The system prompt tells the model not to answer with raw graph-edge syntax.

### Notes + graph retrieval

- Default chat is notes+graph memory, not wiki-first.
- The query path uses note title/content scoring, persisted memory chunks, graph neighborhood expansion, and citation metadata.
- Chat displays structured memory coverage such as `Memory evidence: 1 note · 3 graph edges`.
- Experimental wiki context is opt-in from the chat UI.

### Server-side memory index

- Note saves trigger local memory indexing.
- The server stores memory chunks in SQLite.
- Embeddings prefer Ollama `nomic-embed-text` and fall back to local Xenova paths when needed.

### Graph formatting

- Graph context is formatted in natural language rather than arrow syntax.
- Graph links are still exposed as citations/evidence, but they should not be treated as the answer to factual questions.

## Remaining improvements

### 1. Improve graph UI/UX

The review queue is currently underused. The graph page should prioritize exploration and evidence:

- search/filter graph nodes and relation types
- show clear edge provenance and note excerpts
- explain why each edge exists
- let users ask chat about selected graph items
- make review queue contextual rather than primary

### 2. Persist/cold-start optimization

Memory chunks persist server-side, but browser/vector worker paths still need continued cleanup so reloads avoid unnecessary work everywhere.

### 3. Better reranking

Cosine similarity remains a weak relevance signal. Candidate reranking should be improved with lightweight local rerankers or deterministic evidence scoring.

### 4. Better timing instrumentation

Add timing spans for:

- note load
- lexical retrieval
- memory-index embedding/search
- graph expansion
- prompt construction
- model first token
- model completion

### 5. More regression prompts

Add tests/QA cases where graph context retrieves the correct note but only note text answers the question. These should verify the answer is natural language and not graph syntax.
