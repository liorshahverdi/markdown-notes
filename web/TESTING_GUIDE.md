# MarkdownNotes — Full Testing Guide

Complete manual and automated testing reference for every feature in the MarkdownNotes web app.

---

## Table of Contents

1. [Automated Test Suite](#1-automated-test-suite)
2. [Core Editor](#2-core-editor)
3. [Markdown Toolbar](#3-markdown-toolbar)
4. [Dictation / Voice-to-Text](#4-dictation--voice-to-text)
5. [Voice Query (RAG)](#5-voice-query-rag)
6. [Notes Management](#6-notes-management)
7. [Preview Pane](#7-preview-pane)
8. [Settings Panel](#8-settings-panel)
9. [Import / Export](#9-import--export)
10. [Knowledge Graph](#10-knowledge-graph)
11. [Skill Generation](#11-skill-generation)
12. [Help Page](#12-help-page)
13. [API Endpoints](#13-api-endpoints)
14. [CLI Tool](#14-cli-tool)
15. [Dark Mode](#15-dark-mode)
16. [Keyboard Shortcuts](#16-keyboard-shortcuts)
17. [Resizable Panes](#17-resizable-panes)
18. [Browser Compatibility](#18-browser-compatibility)

---

## 1. Automated Test Suite

### Running Tests

```bash
cd web
npx vitest run          # Full suite (484 tests, 38 files)
npx vitest run --watch  # Watch mode
npx vitest run src/lib/components/  # Run subset by path
```

### CLI Tests

```bash
cd web/cli
npx vitest run          # 29 tests, 2 files
```

### Test Infrastructure

| Component | Library |
|-----------|---------|
| Runner | vitest |
| DOM | jsdom |
| IndexedDB | fake-indexeddb |
| Svelte | @testing-library/svelte |
| Config note | `vite.config.ts` has `resolve.conditions: ['browser']` for Svelte 5 in jsdom |

### Expected Baseline

- **38 test files**, **484 tests** passing
- **2 CLI test files**, **29 tests** passing
- Zero failures before any manual testing begins

---

## 2. Core Editor

The editor is CodeMirror 6-based, located in `src/lib/components/Editor.svelte`.

### Functional Tests

- [ ] Open a note — editor displays the note content
- [ ] Type text — content updates in real time
- [ ] Switch notes — editor content swaps to the new note
- [ ] Undo/redo (`Cmd/Ctrl+Z`, `Cmd/Ctrl+Shift+Z`) works
- [ ] Long documents scroll properly (`.cm-scroller` overflow)
- [ ] Editor fills available vertical space

### Keyboard Shortcuts (Editor)

| Shortcut | Action | Verify |
|----------|--------|--------|
| `Cmd/Ctrl+B` | Bold — wraps selection in `**` | Select text, press shortcut, confirm `**text**` |
| `Cmd/Ctrl+I` | Italic — wraps selection in `_` | Select text, press shortcut, confirm `_text_` |
| `Cmd/Ctrl+Shift+S` | Strikethrough — wraps selection in `~~` | Select text, press shortcut, confirm `~~text~~` |

### Ghost Text (Dictation Integration)

- [ ] Ghost text appears as gray italic at cursor position during dictation
- [ ] Ghost text disappears when user types normally (document change clears it)
- [ ] Ghost text disappears when dictation produces final text
- [ ] Ghost text is not selectable or interactive
- [ ] Ghost text is visible in both light and dark mode

---

## 3. Markdown Toolbar

Located in `src/lib/components/Toolbar.svelte`. Toolbar sits above the editor.

### Headings

- [ ] H1 button prepends `# ` to line
- [ ] H2 button prepends `## ` to line
- [ ] H3 button prepends `### ` to line
- [ ] On narrow screens (<640px), buttons collapse into "H" dropdown

### Formatting

- [ ] **B** wraps selection in `**`
- [ ] **I** wraps selection in `_`
- [ ] **S** wraps selection in `~~`
- [ ] On narrow screens, collapses into "Aa" dropdown

### Lists

- [ ] Checkbox inserts `- [ ] `
- [ ] Bullet inserts `- `
- [ ] Ordered inserts `1. `
- [ ] On narrow screens, collapses into "List" dropdown

### Table Menu

- [ ] "Insert Table" inserts a 3x2 markdown table
- [ ] "Add Row" appends a row to an existing table
- [ ] "Add Column" appends a column to an existing table
- [ ] Menu closes after each action

### Diagram Menu

- [ ] Each template inserts valid Mermaid syntax:
  - Flowchart (`graph TD`)
  - Sequence (`sequenceDiagram`)
  - Class Diagram (`classDiagram`)
  - Decision Tree (`graph TD`)
  - Mind Map (`mindmap` with `%%{init...}%%` theme directive)
  - Timeline (`timeline`)
- [ ] "Set Node Color" opens color picker
- [ ] Color picker "Apply" inserts `classDef` with chosen color
- [ ] Mind map template uses muted, readable node colors (not bright defaults)

### Dictation Button

- [ ] Microphone icon visible at right end of toolbar
- [ ] Tooltip reads "Dictate into note (Cmd/Ctrl+Shift+D)"
- [ ] Click toggles dictation on/off
- [ ] When active: red background with pulsing border animation
- [ ] When inactive: standard gray styling

### Menu Behavior

- [ ] Only one dropdown open at a time
- [ ] Clicking outside any dropdown closes all menus
- [ ] Menus close after selecting an action

---

## 4. Dictation / Voice-to-Text

New feature — continuous speech recognition that inserts text at the cursor.

### Files

| File | Role |
|------|------|
| `src/lib/voice/dictationManager.ts` | Continuous recognition wrapper |
| `src/lib/stores/dictation.ts` | Shared `dictationActive` store |
| `src/lib/components/Editor.svelte` | Ghost text + `insertAtCursor` |
| `src/lib/components/Toolbar.svelte` | Dictate button |
| `src/routes/+page.svelte` | Wiring + keyboard shortcut |

### Activation

- [ ] Click dictation button in toolbar — starts listening
- [ ] `Cmd/Ctrl+Shift+D` — toggles dictation on/off
- [ ] Button pulses red while active

### Speech Input

- [ ] Speak a word — interim text appears as gray italic ghost text at cursor
- [ ] Pause speaking — final text solidifies into real document text
- [ ] Speak multiple sentences — text accumulates at cursor position
- [ ] A trailing space is appended after each final segment

### Deactivation

- [ ] Click dictation button again — stops, ghost text clears
- [ ] `Cmd/Ctrl+Shift+D` again — stops dictation
- [ ] Switch to a different note — dictation stops automatically
- [ ] Recognition error — dictation stops automatically

### Mutual Exclusion

- [ ] While dictating, the RAG Voice Button (`Cmd/Ctrl+Shift+V`) is **disabled**
- [ ] While RAG voice is active, dictation should not start simultaneously

### Edge Cases

- [ ] Start dictation with no note selected — should not crash (no editor mounted)
- [ ] Browser does not support Web Speech API — `isSupported()` returns false gracefully
- [ ] Auto-restart: if browser stops continuous recognition, manager restarts it

---

## 5. Voice Query (RAG)

The RAG voice input in the navigation bar, separate from dictation.

### VoiceButton (`src/lib/components/VoiceButton.svelte`)

- [ ] Click mic button — starts listening, button turns red with pulse ring
- [ ] `Cmd/Ctrl+Shift+V` — toggles voice input
- [ ] Final transcript is passed to `onTranscript` callback
- [ ] Button disabled when `dictationActive` store is true
- [ ] Button disabled when Web Speech API not supported (opacity 0.4)

### VoiceQueryPanel

- [ ] Panel slides up from bottom when active
- [ ] Shows animated avatar with states: idle, listening, thinking, speaking
- [ ] Displays interim transcript in gray italic
- [ ] Shows final transcript in black
- [ ] Shows RAG response after processing
- [ ] Source chips: clickable, show note title + relevance score
- [ ] Clicking a source chip navigates to that note
- [ ] Play/Pause for text-to-speech of response
- [ ] Speed control slider (0.5x to 2x)
- [ ] "Ask follow-up", "Copy response", "Clear" buttons
- [ ] "Clear" dismisses the panel

---

## 6. Notes Management

### Sidebar (`src/lib/components/Sidebar.svelte`)

- [ ] "New Note" button creates a note (also `Cmd/Ctrl+N`)
- [ ] Delete button removes selected note (with confirmation)

### Folder Tree View

The sidebar uses an expandable folder tree (file-explorer style) instead of a flat folder list with breadcrumbs.

- [ ] All folders render as an indented tree with expand/collapse chevrons
- [ ] All folders are expanded by default on page load
- [ ] Notes appear nested under their parent folder (indented) when folder is expanded
- [ ] Root-level (unfiled) notes appear at the bottom of the tree
- [ ] Clicking a folder selects it (blue highlight) and auto-expands if collapsed
- [ ] Chevron click toggles expand/collapse without selecting
- [ ] Note count badge shown on folders with notes
- [ ] New folders are auto-expanded when created
- [ ] New subfolders auto-expand their parent
- [ ] Double-click folder to rename
- [ ] Context menu: Rename, New Subfolder, Move to..., Delete
- [ ] Drag-and-drop: drag a note from anywhere onto any visible folder at any depth
- [ ] Background drop zone moves notes to root (unfiled)

### Search

- [ ] Search bar filters notes by title and content (global, across all folders)
- [ ] Case-insensitive matching
- [ ] Real-time filtering as user types
- [ ] Folder tree hides during search, shows flat global results
- [ ] Clear search restores folder tree view

### Pinning

- [ ] Pin icon toggles pin state on a note
- [ ] Pinned notes appear at top within their folder
- [ ] Pin state persists across sessions

### Persistence

- [ ] Notes stored in IndexedDB via Dexie
- [ ] Changes saved on every keystroke (auto-save)
- [ ] Notes survive page refresh

---

## 7. Preview Pane

### Rendering (`src/lib/components/Preview.svelte`)

- [ ] Live markdown preview updates as user types
- [ ] Supports GFM: tables, task lists, strikethrough, code blocks
- [ ] Mermaid diagrams render inline
- [ ] Code blocks have syntax highlighting
- [ ] Links are clickable
- [ ] Images render (if valid URL)
- [ ] Preview scrolls independently from editor

---

## 8. Settings Panel

Five-tab settings panel, slides out from the right.

### General Tab

- [ ] Font size slider (12-20px) — changes editor/preview font
- [ ] Theme dropdown: System, Light, Dark
- [ ] Settings persist in `localStorage` key `app-settings`

### Voice Tab

- [ ] Language dropdown for speech recognition
- [ ] TTS voice selection from system voices
- [ ] Wake word text input
- [ ] Wake word enable toggle
- [ ] Speech rate slider
- [ ] Speech pitch slider

### RAG Tab

- [ ] Ollama URL input (default: `http://localhost:11434`)
- [ ] Model name input (default: `llama3`)
- [ ] Top-K slider (1-20)
- [ ] Live Ollama status indicator (green/yellow/red)

### Self-Improvement Tab

- [ ] Enable toggle checkbox
- [ ] Interval slider (10-120 min, 5-min increments)
- [ ] Auto-apply threshold slider (0.5-1.0)

### Export Tab

- [ ] "Export all notes (JSON)" downloads `notes-export.json`
- [ ] "Export all notes (Markdown)" downloads individual `.md` files
- [ ] Escape key closes settings panel

---

## 9. Import / Export

### Import (`src/lib/markdown/importExport.ts`)

- [ ] Drag-and-drop `.md` file — creates note with filename as title
- [ ] Drag-and-drop `.json` file — batch imports notes
- [ ] Click to open file dialog — same behavior
- [ ] Success toast shows count of imported notes (auto-dismisses 4s)
- [ ] Error toast shows failure reason
- [ ] Imported notes get new UUIDs

### Export

- [ ] JSON export contains all notes with metadata
- [ ] Markdown export creates individual files
- [ ] Downloaded via `URL.createObjectURL` + anchor click

---

## 10. Knowledge Graph

Route: `/knowledge-graph`

### Graph Visualization

- [ ] Nodes render for each entity (color-coded by type)
- [ ] Edges show relationships with labels
- [ ] Click node — selects it, shows details in right panel
- [ ] Drag node — repositions it
- [ ] Scroll to zoom, drag empty space to pan
- [ ] "Back to Notes" link navigates to `/`

### Entity Type Filters (Left Sidebar)

- [ ] Checkboxes for: note, person, place, organization, topic, tag
- [ ] Unchecking a type hides those nodes
- [ ] Color indicator dots match node colors

### Search

- [ ] Search input filters entities in real time
- [ ] Case-insensitive

### Layout Toggle

- [ ] "Force-Directed" — forceAtlas2Based physics
- [ ] "Hierarchical" — tree-like layout

### Analytics Panel (Bottom, Collapsible)

- [ ] Shows: total nodes, edges, clusters, avg cluster size, modularity
- [ ] Cluster quality heatmap renders
- [ ] Skill candidates shown as cards with confidence scores

### Detail Panel (Right Sidebar)

- [ ] Selected entity shows: name, type badge, confidence %
- [ ] Source notes listed (clickable)
- [ ] Related entities shown with relationship types

### Self-Improvement Feed

- [ ] Historical improvements listed with icons
- [ ] Status badges: auto-applied (green), pending-review (yellow), rejected (red)
- [ ] Timestamps shown
- [ ] Undo button for recent improvements

### Review Queue

- [ ] Pending improvements listed
- [ ] Approve button adds to graph
- [ ] Reject button discards

---

## 11. Skill Generation

### Skill Candidates

- [ ] System identifies topic clusters in knowledge graph
- [ ] Cards show: cluster name, entity count, note count, confidence
- [ ] "Generate Skill" button triggers generation

### Skill Generation Dialog

- [ ] Modal overlay with editable markdown textarea
- [ ] "Generating..." pulse while processing
- [ ] Reject — dismisses without saving
- [ ] Regenerate — creates new skill from same cluster
- [ ] Approve & Save — persists to IndexedDB

### Skill Evidence

- [ ] Inline citations with dotted underline
- [ ] Hover shows note title + matched passage
- [ ] Click navigates to source note

### Skill Management

- [ ] Skill list in right sidebar panel
- [ ] Select skill to view details
- [ ] Delete skill removes from collection

### Skill Combining

- [ ] SkillCombinePanel allows merging related skills
- [ ] Creates composite skill from multiple bases

### Skill Dependency Graph

- [ ] Visualizes prerequisite/enhancing relationships between skills

---

## 12. Help Page

Route: `/help`

- [ ] All 11 help sections render with correct content
- [ ] Search filters sections by title, content, and keywords
- [ ] Keyboard shortcuts table is complete and accurate
- [ ] Navigation back to main app works
- [ ] All code examples render in code blocks

### Help Sections

1. Getting Started
2. Editor
3. Notes Management
4. Voice Assistant
5. RAG System
6. Knowledge Graph
7. Graph Self-Improvement
8. Skill Generation
9. CLI Tool
10. Settings
11. Troubleshooting

---

## 13. API Endpoints

### `GET /api/notes`

- [ ] No params — returns all notes sorted by dateModified desc
- [ ] `?id=<id>` — returns single note
- [ ] `?search=<query>` — filters by title/content (case-insensitive)
- [ ] Missing note returns 404

### `POST /api/query`

- [ ] Body `{ query: "..." }` — returns RAG response with sources
- [ ] Body `{ query: "...", model: "llama3" }` — uses specified model
- [ ] Empty/missing query returns 400
- [ ] Ollama offline returns 503
- [ ] Large notes (>12k chars): response includes content from deep within the note, not just the beginning
- [ ] Specific-person queries (e.g., "what did X say"): response includes quotes from that person even if they appear late in a transcript
- [ ] Summary queries (e.g., "summarize the meeting"): response covers multiple speakers/topics, not just those matching query keywords
- [ ] Multi-note queries (e.g., "what happened across meetings this week"): response synthesizes content from multiple retrieved notes

### `GET/POST /api/graph`

- [ ] Returns graph entity and relationship data
- [ ] POST updates graph data

### `GET/POST /api/skills`

- [ ] GET lists all skills
- [ ] POST creates/deletes skills

---

## 14. CLI Tool

Located in `web/cli/`. Install with `npm link` from `web/cli/`.

### Commands

```bash
mdnotes list                          # List all notes
mdnotes list --search "query"         # Search notes
mdnotes show <note-id>                # Show single note
mdnotes ask "question"                # RAG query
mdnotes ask "question" --model llama3 # RAG with specific model
mdnotes skill list                    # List skills
mdnotes skill generate --notes id1,id2  # Generate skill
mdnotes skill export <id> --out path  # Export skill to file
mdnotes graph                         # Graph operations
mdnotes chat                          # Interactive chat
mdnotes status                        # Check API + Ollama status
```

### Testing

- [ ] `mdnotes list` returns notes when web app is running
- [ ] `mdnotes list --search "test"` filters correctly
- [ ] `mdnotes ask "what is..."` returns response with sources
- [ ] `mdnotes status` shows correct API and Ollama status
- [ ] `--url` flag overrides default `http://localhost:5173`
- [ ] Graceful error when web app is not running

---

## 15. Dark Mode

- [ ] System theme: follows OS `prefers-color-scheme`
- [ ] Light theme: forced light regardless of OS
- [ ] Dark theme: forced dark regardless of OS
- [ ] All components have dark variants (Tailwind `dark:` classes)
- [ ] Ghost text visible in dark mode (`color: #6b7280`)
- [ ] Dictation button pulse visible in dark mode
- [ ] VoiceButton uses dark CSS variables
- [ ] Knowledge graph node colors readable in dark mode
- [ ] Settings panel styled correctly in dark mode

---

## 16. Keyboard Shortcuts — Complete Reference

| Shortcut | Action | Context |
|----------|--------|---------|
| `Cmd/Ctrl+N` | New note | Global |
| `Cmd/Ctrl+B` | Bold | Editor |
| `Cmd/Ctrl+I` | Italic | Editor |
| `Cmd/Ctrl+Shift+S` | Strikethrough | Editor |
| `Cmd/Ctrl+Shift+D` | Toggle dictation | Global |
| `Cmd/Ctrl+Shift+V` | Toggle voice input (RAG) | Global |
| `Cmd/Ctrl+Z` | Undo | Editor |
| `Cmd/Ctrl+Shift+Z` | Redo | Editor |
| `Escape` | Close settings panel | Settings |

### Testing All Shortcuts

- [ ] Each shortcut triggers correct action
- [ ] No conflicts between shortcuts
- [ ] Shortcuts work on both Mac (`Cmd`) and Windows/Linux (`Ctrl`)
- [ ] `Cmd/Ctrl+Shift+D` and `Cmd/Ctrl+Shift+V` are mutually exclusive

---

## 17. Resizable Panes

### Sidebar Resize

- [ ] Drag sidebar divider — width changes (200px min, 400px max)
- [ ] Content reflows correctly
- [ ] Cursor shows `col-resize` during drag
- [ ] Text selection disabled during drag

### Editor/Preview Resize

- [ ] Drag center divider — editor/preview ratio changes (20%-80% bounds)
- [ ] Both panes maintain min-width of 300px
- [ ] Divider highlights on hover (blue border)

---

## 18. Browser Compatibility

### Required APIs

| API | Used For | Best Support |
|-----|----------|-------------|
| Web Speech API | Voice input/dictation | Chrome, Edge |
| IndexedDB | Data persistence | All modern browsers |
| Web Workers | Background embeddings | All modern browsers |
| Fetch API | API communication | All modern browsers |

### Testing Matrix

- [ ] **Chrome** (primary): All features including voice
- [ ] **Firefox**: All features except voice (Web Speech API limited)
- [ ] **Safari**: All features, test voice support
- [ ] **Edge**: All features including voice (Chromium-based)

### Graceful Degradation

- [ ] No Web Speech API — voice buttons disabled, no crashes
- [ ] No Ollama running — RAG returns helpful error, app still works
- [ ] No IndexedDB — app should show error (not silently fail)
