export interface HelpSectionData {
	id: string;
	title: string;
	content: string;
	keywords: string[];
}

export const helpSections: HelpSectionData[] = [
	{
		id: 'getting-started',
		title: 'Getting Started',
		content: `## Welcome to MarkdownNotes

MarkdownNotes is a powerful note-taking application with built-in markdown editing, AI-powered search, voice input, and knowledge graph visualization.

### Creating Your First Note

1. Click the **"+ New Note"** button in the sidebar
2. Give your note a title by typing in the title field
3. Start writing markdown in the left editor pane
4. See real-time rendered preview in the right pane

### Basic Navigation

- **Sidebar** (left): Lists all your notes, sorted by last modified
- **Editor** (center): Write and edit your markdown content
- **Preview / Chat** (right): See rendered preview, or toggle the Chat panel to ask AI questions about your notes
- **Toolbar** (top of editor): Quick-access formatting buttons and dictation toggle
- **Navigation bar** (top): Links to Notes, Knowledge Graph, and Help pages, plus chat toggle, voice input, settings, and dark mode controls

### Layout

The interface uses a three-pane layout. You can resize panes by dragging the dividers between them. The sidebar can be resized between 200px and 400px wide, and the editor/preview split can be adjusted from 20% to 80%.

The right pane toggles between the markdown preview and the Chat panel. Click the **chat icon** (speech bubble) in the top navigation bar to switch between them.`,
		keywords: ['new note', 'create', 'first', 'navigation', 'layout', 'sidebar', 'editor', 'preview', 'chat', 'tutorial', 'beginner']
	},
	{
		id: 'editor',
		title: 'Editor',
		content: `## Markdown Editor

The editor supports full GitHub-Flavored Markdown (GFM) with real-time preview.

### Markdown Syntax Reference

#### Headings
\`\`\`
# Heading 1
## Heading 2
### Heading 3
\`\`\`

#### Text Formatting
- **Bold**: \`**text**\` or \`Cmd/Ctrl + B\`
- *Italic*: \`*text*\` or \`Cmd/Ctrl + I\`
- ~~Strikethrough~~: \`~~text~~\` or \`Cmd/Ctrl + Shift + S\`
- \`Inline code\`: surround with backticks

#### Links and Images
\`\`\`
[Link text](https://example.com)
![Alt text](image-url.png)
\`\`\`

#### Lists
\`\`\`
- Unordered item
- Another item

1. Ordered item
2. Another item

- [ ] Task item (unchecked)
- [x] Task item (checked)
\`\`\`

#### Code Blocks
Use triple backticks with an optional language identifier:
\`\`\`\`
\`\`\`javascript
const greeting = "Hello, world!";
\`\`\`
\`\`\`\`

#### Tables
\`\`\`
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| data     | data     | data     |
\`\`\`

Use the toolbar buttons to insert and modify tables (add rows, add columns).

#### Blockquotes
\`\`\`
> This is a blockquote
> It can span multiple lines
\`\`\`

### Toolbar Buttons

The toolbar provides quick access to common formatting operations:

- **H1, H2, H3**: Insert heading prefixes
- **B, I, S**: Bold, italic, strikethrough
- **List buttons**: Unordered list, ordered list, task list
- **Table**: Insert a 3x2 table, add rows, add columns
- **Diagram**: Insert Mermaid diagram templates (flowchart, sequence, class, state, ER, Gantt, pie, mindmap)
- **Color**: Insert classDef with custom color for Mermaid diagrams

### Diagram Templates

Insert Mermaid diagrams from the toolbar dropdown:

- **Flowchart**: Directed graph with nodes and edges
- **Sequence**: Message sequence between participants
- **Class**: UML class diagram
- **State**: State machine diagram
- **ER**: Entity-relationship diagram
- **Gantt**: Project timeline chart
- **Pie**: Pie chart
- **Mindmap**: Hierarchical mind map`,
		keywords: ['markdown', 'syntax', 'bold', 'italic', 'heading', 'code', 'table', 'link', 'list', 'blockquote', 'toolbar', 'diagram', 'mermaid', 'formatting']
	},
	{
		id: 'notes-management',
		title: 'Notes Management',
		content: `## Managing Your Notes

### Sidebar

The sidebar displays all your notes in reverse chronological order (most recently modified first). Each note shows:

- **Title**: The note's name
- **Preview**: First 80 characters of content
- **Relative date**: How long ago the note was last modified (e.g., "5 minutes ago")

### Searching Notes

Use the search bar at the top of the sidebar to filter notes by title or content. Search is case-insensitive and updates results in real time as you type.

### Pinning Notes

Pin important notes to keep them at the top of the sidebar regardless of modification date. Pinned notes appear above unpinned notes.

### Auto-Save

Notes are automatically saved to IndexedDB as you type. There is no manual save button needed. Changes persist across browser sessions and page reloads.

### Import / Export

- **Export**: Download individual notes as \`.md\` files or export all notes as a JSON bundle
- **Import**: Drag and drop \`.md\` files or use the import button to load markdown files as new notes`,
		keywords: ['sidebar', 'search', 'pin', 'save', 'auto-save', 'import', 'export', 'organize', 'filter', 'indexeddb']
	},
	{
		id: 'voice-assistant',
		title: 'Voice & Dictation',
		content: `## Voice & Dictation

MarkdownNotes offers two ways to use your voice: **dictation** for inserting text into notes, and **voice chat** for asking AI questions about your notes.

### Setup

1. Ensure your browser supports the Web Speech API (Chrome recommended, partial support in Firefox)
2. Grant microphone permission when prompted

### Dictation Mode

Dictation inserts spoken text directly into your note at the cursor position.

- **Toolbar button**: Click the microphone icon in the editor toolbar to toggle dictation on/off
- **Keyboard shortcut**: Press \`Cmd/Ctrl + Shift + D\` to toggle dictation
- While dictating, interim (in-progress) text appears as ghost text in the editor, and finalized text is inserted automatically
- Dictation stops automatically when you switch notes

### Voice Input in Nav Bar

The **microphone button** in the top navigation bar provides quick voice input (shortcut: \`Cmd/Ctrl + Shift + V\`). Click it to speak, and the recognized text is captured for use.

### Voice Chat (Chat Panel)

The Chat panel includes a **mic button** next to the text input. Click it to speak a question — the transcribed text is automatically submitted to the notes/graph chat backed by Laguna through llama.cpp, just as if you had typed it.

1. Open the Chat panel by clicking the **chat icon** (speech bubble) in the nav bar
2. Click the mic button in the Chat panel's input bar
3. Speak your question clearly
4. The transcript is auto-submitted and the AI streams a response

### Tips for Better Recognition

- Speak clearly and at a moderate pace
- Reduce background noise for more accurate transcription
- Use specific keywords that appear in your notes
- Keep queries concise and focused on one topic`,
		keywords: ['voice', 'speech', 'microphone', 'dictation', 'recognition', 'chat', 'mic', 'transcription']
	},
	{
		id: 'rag-system',
		title: 'RAG & Chat',
		content: `## RAG & Chat

RAG (Retrieval-Augmented Generation) enhances AI responses by searching your notes for relevant context, then using that context to generate accurate, grounded answers.

### What Is RAG?

Instead of relying solely on the AI model's training data, RAG:

1. **Retrieves** relevant passages from your notes using vector similarity search
2. **Augments** the AI prompt with those passages as context
3. **Generates** a response that references your actual notes

This means answers are specific to your notes, not generic.

### Using the Chat Panel

The Chat panel is the primary way to ask questions about your notes:

1. Click the **chat icon** (speech bubble) in the top navigation bar — this replaces the preview pane with the Chat panel
2. Type your question in the input field and press Enter, or click the send button
3. Alternatively, click the **mic button** to speak your question (auto-submits on recognition)
4. The AI streams its response in real time as chat bubbles
5. Source note chips appear below responses — click them to navigate to the referenced note
6. Click the chat icon again to return to the preview pane

### Referencing Notes by Title

You can ask about a specific note by including its title in your query (e.g., "summarize AMS standup transcript 4/6/2026"). The system detects title matches and uses that note as context without requiring an embedding index. You can also use words like "this note" or "the current note" to refer to the currently selected note.

### llama.cpp Backend

Generative features use **Laguna XS 2.1 through llama.cpp on the hub**. The hub owns its backend address, model and API credentials. No Ollama service or fallback is used.

The status pill shows whether the configured Laguna model is available. Switching the shared fleet away from Laguna makes these features unavailable until Laguna is restored; the app does not start, stop or evict fleet models.

### Remote Access

Health checks, streaming chat and structured extraction use same-origin \`/api/llm/*\` endpoints. Phones and other computers only need access to the hub URL, not an inference service on their own device. Backend credentials never go to the browser.

### Retrieval

Notes are retrieved by title/keyword matches and knowledge-graph evidence. Embedding inference is disabled; existing stored vectors are retained but not queried. Laguna receives the retrieved note context to answer questions.

### Asking Good Questions

- Be specific: "What did I write about React hooks?" instead of "Tell me about React"
- Reference notes by title when you want a specific note summarized
- Ask follow-up questions to build on previous responses in the chat
- If a retry gives the same wrong answer, click **Clear** to reset the conversation and try again`,
		keywords: ['rag', 'ollama', 'ai', 'retrieval', 'augmented', 'generation', 'vector', 'embeddings', 'llm', 'model', 'query', 'search', 'chat', 'remote', 'proxy']
	},
	{
		id: 'knowledge-graph',
		title: 'Knowledge Graph',
		content: `## Knowledge Graph

The Knowledge Graph provides a visual map of entities and relationships extracted from your notes.

### Navigation

- Access the graph from the **Knowledge Graph** link in the top navigation bar
- **Pan**: Click and drag on empty space
- **Zoom**: Scroll wheel or pinch gesture
- **Select**: Click a node to view its details in the side panel
- **Multi-select**: Hold Shift and click multiple nodes

### Entity Types and Colors

Nodes are color-coded by entity type:

- **Person** (blue): People mentioned in your notes
- **Concept** (green): Ideas, topics, and abstract concepts
- **Technology** (orange): Tools, frameworks, languages, and platforms
- **Organization** (purple): Companies, teams, and groups
- **Location** (red): Places and geographical references
- **Event** (yellow): Dates, meetings, and occurrences

### Filtering

Use the control panel to:

- Filter by entity type (show/hide specific categories)
- Search for specific entities by name
- Adjust the physics simulation (repulsion, spring length)
- Toggle labels on/off

### Relationships

Edges between nodes represent relationships found in your notes. The relationship label describes how two entities are connected (e.g., "uses", "works at", "related to"). Edge thickness indicates the strength or frequency of the relationship.`,
		keywords: ['graph', 'knowledge', 'entity', 'relationship', 'node', 'edge', 'visualization', 'network', 'filter', 'pan', 'zoom']
	},
	{
		id: 'graph-self-improvement',
		title: 'Graph Self-Improvement',
		content: `## Graph Self-Improvement

The knowledge graph improves itself on the hub (the server), not in your browser. Its output feeds the chat answers directly.

### How it works

- **Base graph**: Rebuilt from your current notes every time it is read: headings, tags, links, diagrams and folders. When you edit or delete a note, its entities and edges go away too.
- **Enrichment layer**: Everything the loop adds is stored on top of the base graph as a proposal with its source note and excerpt. Each change can be undone on its own.

Each pass runs these stages:

1. **Co-occurrence links**: Entities that appear together more often than chance (normalized PMI). Tags and folders that appear everywhere are ignored.
2. **Duplicates**: Same-type entities with near-identical names. Notes and folders are never merged, and names that differ in their numbers (dates, versions) are never matched. A merge is applied automatically only if Laguna confirms it.
3. **Hidden relationships** (Laguna): The model only sees entities from the note, must use their exact names, and must quote the note as evidence. Edges whose quote is not found in the note always go to review.
4. **Type checks and missed entities** (Laguna): Type corrections always go to review. Missed entities must appear word for word in the note.

Recently changed notes are processed first. Every note is marked done even when nothing is found, so the queue keeps moving. A note is processed again when you edit it.

### When it runs

- A few seconds after you save, move or delete a note
- Every hour
- When you click **Run enrichment now** on the Knowledge Graph page

If Laguna is not loaded, the model stages are skipped; the loop never loads it.

### Reviewing

The **Self-improvement** panel lists proposals waiting for review, with **Approve**/**Reject**. Applied items have **Confirm**/**Undo**. Edges can also be accepted, rejected or retyped from the edge evidence drawer. Rejected and undone proposals are never proposed again, even after **Re-process all notes**.

### Learning from feedback

- **Thresholds**: Auto-apply thresholds are learned for each source from your reviews. Sources you mostly reject switch to review only, and sources you reliably accept are applied more readily.
- **Answer feedback**: When you open a source cited in a chat answer, the graph edges behind it get credit, and the question is saved for the retrieval check. Automatic edges that are never used lose weight after 30 days.
- **Retrieval check**: Each pass compares how well the saved questions find their notes before and after its changes. If the answers get worse, that pass's automatic changes go back to review.
- **Loop health**: This panel shows precision, provenance coverage, wrong-merge rate, duplicate rate and the last pass.

### Multi-hop suggestions

Click a node to see dashed multi-hop suggestions. They are built only from explicit or accepted edges and are not saved unless you accept them.

### Edge Evidence Review

Select an edge to open its evidence drawer, where you can accept, reject or retype it, or generate a skill from its source notes.`,
		keywords: ['self-improvement', 'autonomous', 'learning', 'review', 'queue', 'approve', 'reject', 'undo', 'interval', 'scan', 'trace', 'reasoning', 'background', 'hourly']
	},
	{
		id: 'skill-generation',
		title: 'Skill Generation',
		content: `## Skill Generation

The skill generation system analyzes your notes to identify topics you are knowledgeable about and creates structured skill summaries with evidence.

### How Skills Are Generated

1. The system identifies recurring topics and concepts across your notes
2. Related notes are clustered by topic similarity
3. A skill candidate is generated with a title, description, and proficiency level
4. Evidence passages from your notes are attached to support the skill

### Reviewing Skills with Evidence

Each generated skill includes:

- **Title**: The skill name (e.g., "React Development")
- **Description**: A summary of your knowledge in this area
- **Evidence**: Specific passages from your notes that demonstrate this skill
- **Proficiency level**: Estimated based on depth and breadth of coverage

Click on evidence annotations to jump to the source note.

### Editing Sections

You can edit any part of a generated skill:

- Modify the title or description for accuracy
- Adjust the proficiency level
- Remove irrelevant evidence passages
- Add manual notes or context

### Exporting Skills

Export your skills as:

- **JSON**: Machine-readable format for integration with other tools
- **Markdown**: Human-readable skill profile document
- **PDF**: Printable skill summary`,
		keywords: ['skill', 'generation', 'candidate', 'evidence', 'proficiency', 'export', 'topic', 'cluster', 'review']
	},
	{
		id: 'cli',
		title: 'CLI Tool',
		content: `## CLI Tool

MarkdownNotes includes a command-line interface for working with your notes from the terminal.

### Installation

\`\`\`bash
# From the project root
cd cli
npm link
\`\`\`

After linking, the \`mdnotes\` command is available globally.

### Commands

#### List Notes
\`\`\`bash
mdnotes list
mdnotes list --sort title
mdnotes list --limit 10
\`\`\`

#### Search Notes
\`\`\`bash
mdnotes search "react hooks"
mdnotes search "typescript" --limit 5
\`\`\`

#### View a Note
\`\`\`bash
mdnotes view <note-id>
mdnotes view <note-id> --raw    # Show raw markdown
\`\`\`

#### Create a Note
\`\`\`bash
mdnotes create "My New Note"
mdnotes create "My New Note" --content "Initial content here"
mdnotes create "My New Note" --file ./draft.md
\`\`\`

#### Query (RAG)
\`\`\`bash
mdnotes query "What do I know about React?"
mdnotes query "Summarize my project notes"
\`\`\`

#### Export
\`\`\`bash
mdnotes export --format md --output ./notes/
mdnotes export --format json --output ./backup.json
\`\`\``,
		keywords: ['cli', 'command', 'terminal', 'npm link', 'mdnotes', 'list', 'search', 'view', 'create', 'query', 'export']
	},
	{
		id: 'settings',
		title: 'Settings',
		content: `## Settings

All configurable options for MarkdownNotes.

### General
- **Dark mode**: Toggle between light and dark themes
- **Auto-save interval**: How frequently content is persisted (default: on every change)
- **Default note sort**: Sort sidebar by last modified, title, or created date

### Editor
- **Font size**: Adjust editor font size (12px - 24px)
- **Tab size**: Number of spaces per tab (2 or 4)
- **Line wrapping**: Enable or disable soft line wrapping
- **Vim mode**: Enable Vim keybindings in the editor

### Voice
- **Voice selection**: Choose text-to-speech voice from system voices
- **Language**: Speech recognition language (default: en-US)
- **Speech rate / pitch**: Adjust text-to-speech playback speed and pitch

### RAG / AI
- **Backend**: Laguna XS 2.1 via llama.cpp, configured on the hub server
- **Retrieval**: Keywords and knowledge graph; embedding inference is disabled
- **Top-K results**: Number of note passages to include in RAG context (1-20)
- **Status indicator**: Shows whether the configured Laguna model is available through llama.cpp (green = connected, red = disconnected)

### Self-Improvement
- **Enable self-improvement**: Toggle the hourly background self-improvement loop. When enabled, the system analyzes your knowledge graph every hour for new relationships, duplicates, and LLM-powered improvements.
- **Auto-apply threshold**: Confidence level (0.50 - 1.00) above which proposals are applied automatically. Lower values = more aggressive auto-application. Higher values = more proposals remain available for manual evidence review.`,
		keywords: ['settings', 'configuration', 'options', 'dark mode', 'font', 'tab', 'vim', 'ollama', 'endpoint', 'theme', 'self-improvement', 'threshold', 'proxy']
	},
	{
		id: 'troubleshooting',
		title: 'Troubleshooting',
		content: `## Troubleshooting

### Laguna / llama.cpp Offline

**Symptom**: Generative queries fail or the Laguna status pill shows offline.

**Solution**:
1. Check the local fleet status on the hub. Laguna XS must be healthy on its configured endpoint.
2. Verify the hub service has LLAMACPP_BASE_URL, LLAMACPP_MODEL and the private LLAMACPP_API_KEY configured.
3. Click the restart button next to the Laguna status pill. The hub releases any lease it holds, starts Laguna on the fleet if needed and holds a lease while a visible tab is open (released after 20 idle minutes). If another resident model would be stopped you are asked first; models leased by another Pi session are never evicted. The app never evicts models automatically.
4. If Laguna is busy, another app or Pi session may be using its single inference slot. Retry after that request finishes.

Keyword/graph retrieval does not need an inference backend. Remote clients never need to install a model service.

### Voice Not Working in Firefox

**Symptom**: Microphone button does not respond or speech is not recognized.

**Solution**:
- Firefox has limited Web Speech API support. For best results, use Chrome or a Chromium-based browser.
- Ensure microphone permissions are granted in browser settings (about:preferences#privacy)
- Check that no other application is using the microphone exclusively

### Performance Tips

- **Large note collections**: If the app feels slow with many notes, try closing unused browser tabs to free memory
- **Knowledge graph**: Large graphs (500+ nodes) may benefit from disabling physics simulation in the graph controls
- **Retrieval**: Keyword/graph search does not load an embedding model or run background embedding jobs.
- **Mermaid diagrams**: Complex diagrams may slow the preview. Consider simplifying or splitting into multiple diagrams.

### Data Persistence

All data is stored in your browser's IndexedDB. To back up your notes:
1. Use the Export function to create a JSON backup
2. Store the file in a safe location
3. To restore, use Import to load the JSON file

**Note**: Clearing browser data or using private/incognito mode will not have access to your saved notes.`,
		keywords: ['troubleshooting', 'error', 'fix', 'ollama', 'firefox', 'voice', 'performance', 'slow', 'backup', 'data', 'indexeddb']
	}
];

export const keyboardShortcuts: Array<{ key: string; description: string; section: string }> = [
	{ key: 'Cmd/Ctrl + B', description: 'Bold', section: 'Editor' },
	{ key: 'Cmd/Ctrl + I', description: 'Italic', section: 'Editor' },
	{ key: 'Cmd/Ctrl + Shift + S', description: 'Strikethrough', section: 'Editor' },
	{ key: 'Cmd/Ctrl + Shift + D', description: 'Toggle dictation mode', section: 'Voice' },
	{ key: 'Cmd/Ctrl + Shift + V', description: 'Toggle nav bar voice input', section: 'Voice' },
	{ key: 'Cmd/Ctrl + S', description: 'Force save', section: 'General' },
	{ key: 'Cmd/Ctrl + N', description: 'New note', section: 'Navigation' },
	{ key: 'Cmd/Ctrl + P', description: 'Search notes', section: 'Navigation' },
	{ key: 'Cmd/Ctrl + /', description: 'Toggle preview', section: 'Editor' },
	{ key: 'Cmd/Ctrl + Shift + H', description: 'Toggle heading level', section: 'Editor' },
	{ key: 'Tab', description: 'Indent list item', section: 'Editor' },
	{ key: 'Shift + Tab', description: 'Outdent list item', section: 'Editor' }
];

export function searchHelp(query: string): HelpSectionData[] {
	if (!query.trim()) {
		return helpSections;
	}

	const lowerQuery = query.toLowerCase();

	return helpSections.filter((section) => {
		const titleMatch = section.title.toLowerCase().includes(lowerQuery);
		const contentMatch = section.content.toLowerCase().includes(lowerQuery);
		const keywordMatch = section.keywords.some((kw) => kw.toLowerCase().includes(lowerQuery));
		return titleMatch || contentMatch || keywordMatch;
	});
}
