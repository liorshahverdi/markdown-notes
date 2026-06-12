# MarkdownNotes — Improvement Plan

## High Impact, Moderate Effort

### 1. Markdown Tables
- The renderer doesn't support `| col | col |` table syntax
- Tables are extremely common in markdown; this is a significant gap
- Implement detection of `|`-delimited rows, header separator (`|---|---|`), and emit `<table>` HTML
- Support alignment markers (`:---`, `:---:`, `---:`)

### 2. Word / Character Count
- Add a small status bar at the bottom of the editor pane
- Show word count, character count, and optionally line count
- Updates live as the user types (debounced to avoid performance issues)

### 3. Keyboard Shortcuts
- **Cmd+B** — toggle bold (`**text**`)
- **Cmd+I** — toggle italic (`_text_`)
- **Cmd+Shift+S** — toggle strikethrough (`~~text~~`)
- **Cmd+Shift+K** — insert inline code
- **Cmd+1/2/3** — insert heading level 1/2/3
- Should work contextually: wrap selected text if possible, insert placeholder otherwise

### 4. Syntax Highlighting in the Editor
- Color headings, bold/italic markers, code blocks, links, and list markers differently from body text
- Even basic coloring (e.g., headings in blue, code in gray background) significantly improves the editing experience
- Consider using `NSTextView` with attributed strings or a custom `TextEditor` overlay

### 5. Note Pinning / Favorites
- Add a pin/star toggle per note
- Pinned notes sort to the top of the sidebar, above unpinned notes
- Persist pin state (either in the `Note` model saved to disk, or as metadata)
- Add a pin icon in the sidebar and a context menu option to toggle

---

## Medium Impact, Low Effort

### 6. Image Support in Preview
- Render `![alt text](url)` markdown image syntax as `<img>` tags in the preview
- Support both remote URLs and local file paths
- Add basic styling: `max-width: 100%` to prevent overflow

### 7. Nested List Support
- Currently, indented sub-lists (e.g., `  - sub-item`) don't render correctly
- Detect indentation level and emit nested `<ul>`/`<ol>` elements
- Support at least 3 levels of nesting

### 8. Note Creation Date
- Track when a note was first created (separate from modification date)
- Display creation date in the sidebar or a note info panel
- Persist in the `Note` model

### 9. Word Wrap / Font Size Preferences
- Add a simple settings/preferences panel (Cmd+,)
- Font size slider for the editor
- Toggle for word wrap behavior
- Persist preferences with `UserDefaults`

---

## Longer-Term

### 10. Folders or Tags
- Organize notes beyond flat list + search
- Option A: Folder hierarchy (subdirectories in ~/Documents/MarkdownNotes/)
- Option B: Tags stored as YAML front matter or sidecar metadata
- Sidebar groups by folder or filters by tag

### 11. Inter-Note Linking
- Support `[[Note Title]]` wiki-style links
- Clicking a link in the preview navigates to (or opens) the referenced note
- Autocomplete note titles when typing `[[`

### 12. Version History
- Keep snapshots of note content on save (e.g., last 10 versions)
- Store in a `.versions/` subdirectory or SQLite database
- UI to browse and restore previous versions

### 13. Export Notes
- Export individual notes as PDF, HTML, or plain markdown
- Bulk export: zip all notes or selected notes
- PDF export using the WebView's print-to-PDF capability

### 14. iCloud Sync
- Move note storage to iCloud Drive container
- Automatic cross-device sync for users with iCloud enabled
- Handle conflict resolution for simultaneous edits
