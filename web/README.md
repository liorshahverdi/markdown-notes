# MarkdownNotes

A local-first, AI-augmented markdown note-taking app with knowledge graph extraction, RAG-powered chat, voice dictation, and skill generation.

Built with SvelteKit, TypeScript, CodeMirror 6, and local LLMs via Ollama.

---

## Features

### Editor

- **CodeMirror 6** markdown editor with syntax highlighting, undo/redo, and auto-save (1s debounce)
- **Live preview** pane with GitHub Flavored Markdown, footnotes, and syntax-highlighted code blocks
- **Formatting toolbar** — headings (H1–H3), bold, italic, strikethrough, code, blockquotes, ordered/unordered lists, and checkboxes
- **Table editing** — insert tables, add/remove rows and columns
- **Mermaid diagrams** — insert flowcharts, sequence diagrams, class diagrams, decision trees, mind maps, and timelines from templates, with node color customization
- **Status bar** — live word count, character count, and line count
- **Keyboard shortcuts** — `Cmd/Ctrl+B` bold, `Cmd/Ctrl+I` italic, `Cmd/Ctrl+Shift+S` strikethrough, `Cmd/Ctrl+N` new note, `Cmd/Ctrl+Z` undo
- **Dark/light theme** with system-preference detection

### Folder Tree Sidebar

- **Expandable folder hierarchy** — folders render as an indented tree with expand/collapse chevrons, all expanded by default on load
- **Inline notes** — notes appear nested under their parent folder in the tree, not in a separate list
- **Drag-and-drop** — drag any note onto any visible folder at any depth; drop on the sidebar background to move to root
- **Folder management** — create, rename (double-click), delete, move, and create subfolders via context menu
- **Search** — filters notes globally across all folders; folder tree hides during search and shows flat results
- **Pinning** — pinned notes sort to the top within their folder

### RAG Chat

Ask questions about your notes using a local LLM. The chat panel retrieves relevant content via semantic search and sends it as context to the model.

- **Semantic search** — notes are chunked (500 tokens, 200-char overlap) and embedded with [all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) via a Web Worker; server-side search uses the same model via `@xenova/transformers`
- **Knowledge graph boosting** — search results are re-ranked using entity relationships from the knowledge graph
- **Smart excerpt extraction** — large notes are split by markdown sections and scored by query relevance; section headers get bonus weight; paragraphs within sections are scored individually so content deep in a long note is found
- **Broad vs. focused queries** — summary queries ("summarize the meeting", "what did everyone discuss") use even paragraph sampling across sections for full coverage; specific queries ("what did X say") prioritize paragraphs matching the target
- **Relevance-weighted budgets** — higher-scored notes get proportionally more of the 32k-char context window
- **Lost-in-the-middle mitigation** — highest-relevance notes are placed last in the prompt, closest to the instruction
- **Streaming responses** — tokens stream from Ollama in real time
- **Source citations** — clickable chips showing which notes were used, with relevance scores
- **Configurable** — Ollama URL, model name, and top-K are adjustable in settings (server requests only accept loopback/local Ollama URLs such as `localhost`, `127.0.0.1`, or `::1`)

### Voice

- **Dictation** (`Cmd/Ctrl+Shift+D`) — continuous speech recognition inserts text at the cursor; interim text shown as gray ghost text, finalized on pause
- **Voice query** (`Cmd/Ctrl+Shift+V`) — speak a question to query notes via RAG; animated avatar shows listening/thinking/speaking states
- **Text-to-speech** — play back RAG responses with adjustable speed (0.5x–2x)
- **Mutual exclusion** — dictation and voice query cannot run simultaneously
- **Wake word** — optional configurable wake word to activate voice input

### Knowledge Graph

Route: `/knowledge-graph`

- **Automatic entity extraction** — extracts notes, topics (from headings), tags (from hashtags), and links from markdown content
- **Relationship discovery** — detects co-occurrences, transitive relationships, and implicit connections between entities
- **Interactive visualization** — vis.js network graph with color-coded entity types, drag-to-reposition nodes, zoom, and pan
- **Layout modes** — force-directed (forceAtlas2Based) or hierarchical tree layout
- **Filtering** — toggle entity types (note, person, place, organization, topic, tag) and search by name
- **Detail panel** — select a node to see its type, confidence, source notes, and related entities
- **Analytics** — total nodes/edges, cluster count, average cluster size, modularity score, cluster quality heatmap
- **Self-improvement** — autonomous enhancement loop (configurable interval, default 30 min) proposes merges, deduplication, and transitive inferences; improvements above the auto-apply threshold (default 0.8) are applied automatically; others go to a review queue
- **Re-indexing on folder move** — moving a note to a different folder re-extracts graph entities with updated folder context

### Skill Generation

- **Cluster detection** — identifies knowledge clusters in the graph and scores them as skill candidates by cohesion, density, and modularity
- **LLM-powered generation** — generates structured skill documents from cluster content using Ollama
- **Evidence linking** — inline citations with dotted underlines; hover shows source note and matched passage; click navigates to source
- **Skill combining** — merge related skills, create prerequisite chains, or build bridge skills connecting clusters
- **Dependency graph** — hierarchical visualization of skill prerequisites and enhancements

### Authentication & Sharing

- **User accounts** — signup/login with bcrypt password hashing and cookie-based sessions (7-day expiry)
- **Note sharing** — toggle a note as shared; other users see it in the "Shared" tab (read-only)
- **Owner tracking** — shared notes display the owner's username

### Import & Export

- **Import** — drag-and-drop `.md` or `.json` files to create notes; bulk import with validation
- **Export** — download all notes as a single JSON file or as individual `.md` files

### Settings

Five-tab settings panel:

| Tab | Options |
|-----|---------|
| General | Font size (12–20px), theme (system/light/dark) |
| Voice | Recognition language, TTS voice, wake word, speech rate/pitch |
| RAG | Ollama URL, model name, top-K (1–20), live health indicator |
| Self-Improvement | Enable/disable, interval (10–120 min), auto-apply threshold (0.5–1.0) |
| Export | Export all notes as JSON or Markdown |

### Storage & Sync

- **Server-side persistence** — notes and folders stored as JSON files per user on the server
- **Client-side caching** — IndexedDB (Dexie) for offline access and embedding storage
- **Adaptive sync** — polls every 3s when active, 15s when idle; pauses on tab hide, resumes on focus
- **ETag-based caching** — 304 Not Modified responses skip re-processing
- **Migration** — automatic one-time migration from IndexedDB-only to server storage

---

## CLI

A companion CLI tool in `cli/` for terminal-based access.

```bash
cd cli && npm link
```

| Command | Description |
|---------|-------------|
| `mdnotes list [--search "query"]` | List or search notes |
| `mdnotes show <note-id>` | Display a note |
| `mdnotes ask "question" [--model llama3]` | RAG query |
| `mdnotes chat` | Interactive multi-turn chat |
| `mdnotes skill list` | List generated skills |
| `mdnotes skill generate --notes id1,id2` | Generate a skill |
| `mdnotes skill export <id> --out path` | Export skill to file |
| `mdnotes graph` | Knowledge graph operations |
| `mdnotes status` | Check API and Ollama connectivity |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | SvelteKit + TypeScript |
| Editor | CodeMirror 6 |
| Markdown | unified + remark + rehype (GFM, footnotes) |
| Diagrams | Mermaid |
| Styling | Tailwind CSS |
| Database | IndexedDB (Dexie) + server-side JSON files |
| Embeddings | all-MiniLM-L6-v2 via `@xenova/transformers` |
| LLM | Ollama (local, any model — default llama3.2:3b) |
| Graph viz | vis.js |
| Voice | Web Speech API |
| Auth | bcrypt + cookie sessions |
| CLI | Commander.js |
| Testing | Vitest + jsdom + @testing-library/svelte |

---

## Getting Started

### Prerequisites

- Node.js 18+
- [Ollama](https://ollama.ai) running locally (for RAG chat and skill generation)

### Setup

```bash
npm install
npx ollama pull llama3.2:3b   # or any model
npm run dev
```

The app runs at `http://localhost:5173`.

### Tests

```bash
npx vitest run              # ~540 tests across 44 files
npx vitest run --watch      # watch mode
cd cli && npx vitest run    # CLI tests
```

---

## Project Structure

```
src/
├── lib/
│   ├── components/    # 49 Svelte components
│   ├── stores/        # Svelte stores (notes, folders, chat, rag, graph, skills, user, dictation)
│   ├── vector/        # Embedding, vector store, RAG pipeline, reranker
│   ├── graph/         # Entity extraction, relationship discovery, analytics, self-improvement
│   ├── skills/        # Cluster detection, skill generation, combining, dependencies
│   ├── voice/         # Speech recognition, synthesis, dictation, wake word
│   ├── markdown/      # Renderer, import/export, diagram templates, table export
│   ├── db/            # Dexie IndexedDB schema
│   └── server/        # Auth, note file persistence
├── routes/
│   ├── +page.svelte           # Main app (3-pane layout)
│   ├── login/                 # Auth page
│   ├── help/                  # Help documentation
│   ├── knowledge-graph/       # Graph visualization
│   └── api/                   # REST endpoints (notes, folders, query, graph, skills, auth, images)
├── types/                     # TypeScript interfaces (NoteRecord, FolderRecord, GraphEntity, etc.)
cli/                           # Commander.js CLI tool
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notes` | List notes (optional `?search=`, `?id=`) |
| POST | `/api/notes` | Create or update a note |
| DELETE | `/api/notes?id=` | Delete a note |
| GET | `/api/notes/shared` | List shared notes from all users |
| GET/POST | `/api/folders` | List or create/update folders |
| DELETE | `/api/folders?id=` | Delete a folder |
| POST | `/api/query` | RAG query (`{ query, model?, ollamaUrl? }`, loopback Ollama URLs only) |
| GET/POST | `/api/graph` | Knowledge graph entities and relations |
| GET/POST | `/api/skills` | Skill management |
| POST | `/api/auth` | Login, signup, logout |
| POST | `/api/images` | Image upload |
