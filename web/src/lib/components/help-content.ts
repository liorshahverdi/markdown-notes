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

The Chat panel includes a **mic button** next to the text input. Click it to speak a question — the transcribed text is automatically submitted as a query to Ollama, just as if you had typed it.

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

You can ask about a specific note by including its title in your query (e.g., "summarize AMS standup transcript 4/6/2026"). The system detects title matches and uses that note as context, even if vector search hasn't indexed it yet. You can also use words like "this note" or "the current note" to refer to the currently selected note.

### Ollama Setup

RAG requires an Ollama instance for the language model. Ollama runs on the **server** — all AI requests are proxied through the app server, so you can access the app from any device on your network without needing Ollama installed locally on each device.

1. Install Ollama on the **server** from [ollama.ai](https://ollama.ai)
2. Pull a model: \`ollama pull qwen2.5:3b\` (or another supported model)
3. Start Ollama: \`ollama serve\` (runs on port 11434 by default)
4. The green/red status dot in the nav bar shows whether Ollama is connected

### Remote Access

The app proxies all Ollama calls through the server (\`/api/ollama/*\` endpoints). This means:

- **Health checks**, **streaming chat**, and **JSON extraction** all go through the server
- You can access the app from any device on your network (phone, tablet, another computer) and chat works without Ollama running on that device
- The Ollama URL in settings refers to where the **server** can reach Ollama (usually \`http://localhost:11434\`)

### Model Selection

In Settings, you can choose which Ollama model to use. Smaller models (e.g., \`qwen2.5:3b\` or \`llama3.2:3b\`) are faster but less capable. Larger models provide better quality but require more resources.

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

The knowledge graph can autonomously learn and improve over time by analyzing your notes for new entities and relationships.

### How Autonomous Learning Works

The self-improvement loop runs five analysis stages:

1. **Relationship discovery**: Finds entities that co-occur in 2+ notes but have no direct link, and proposes a relationship
2. **Entity deduplication**: Detects near-duplicate entities (e.g., "Dr. Smith" and "Smith") and proposes merging them
3. **Entity validation** (requires Ollama): Uses the LLM to verify that extracted entity types are correct (e.g., "AMS" classified as Organization, not Topic)
4. **Implicit extraction** (requires Ollama): Uses the LLM to discover relationships that aren't explicitly stated but are implied in the text
5. **Auto-apply / evidence review**: High-confidence proposals (above the threshold) are applied automatically; lower-confidence relationship evidence can be inspected and accepted/rejected from the edge detail drawer

### Background Loop

When enabled in Settings, self-improvement runs automatically **every hour** in the background. On app startup, it checks whether a run happened in the past hour and skips if so — this prevents duplicate runs after a page refresh or server restart. You can also trigger a run manually by clicking **Sync Notes** on the Knowledge Graph page.

### Reasoning Traces

Every self-improvement run (as well as chat queries and entity extractions) produces a **reasoning trace** visible in the "Reasoning Traces" panel on the Knowledge Graph page. Traces explain **why** each decision was made:

- Why a relationship was proposed (which notes the entities co-occur in, confidence score)
- Why an entity merge was suggested (name similarity percentage, the reason)
- Why an entity type correction was proposed (LLM reasoning against note content)
- Why a candidate was rejected (below threshold, already proposed, duplicate)

Click a trace to expand its stages, then click a stage to see individual decisions.

### Edge Evidence Review

Select a relationship edge in the Knowledge Graph to open its evidence drawer. For each edge, you can:

- **Accept**: Mark the relationship as reviewed and trusted
- **Reject**: Hide the relationship from the normal graph view
- **Edit**: Adjust the relationship type
- **Generate skill**: Draft a skill from the edge's cited source notes and provenance

### Undo Changes

If an approved change turns out to be incorrect, you can undo supported self-improvement records from the graph detail panel, or reject an incorrect relationship edge from the edge evidence drawer.

### Configuration

In Settings > Self-Improvement:

- **Enable/disable**: Toggle the background self-improvement loop
- **Auto-apply threshold**: Confidence level above which proposals are applied automatically (0.5 - 1.0). Higher values mean more conservative auto-application.`,
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
mdnotes query "Summarize my project notes" --model qwen2.5:3b
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
- **Ollama URL**: Where the server can reach Ollama (default: \`http://localhost:11434\`). All requests are proxied through the server, so this should be the address from the server's perspective.
- **Model**: Which Ollama model to use for RAG queries and self-improvement
- **Top-K results**: Number of note passages to include in RAG context (1-20)
- **Status indicator**: Shows whether Ollama is reachable (green = connected, red = disconnected)

### Self-Improvement
- **Enable self-improvement**: Toggle the hourly background self-improvement loop. When enabled, the system analyzes your knowledge graph every hour for new relationships, duplicates, and LLM-powered improvements.
- **Auto-apply threshold**: Confidence level (0.50 - 1.00) above which proposals are applied automatically. Lower values = more aggressive auto-application. Higher values = more proposals remain available for manual evidence review.`,
		keywords: ['settings', 'configuration', 'options', 'dark mode', 'font', 'tab', 'vim', 'ollama', 'endpoint', 'theme', 'self-improvement', 'threshold', 'proxy']
	},
	{
		id: 'troubleshooting',
		title: 'Troubleshooting',
		content: `## Troubleshooting

### Ollama Not Running

**Symptom**: Chat panel queries fail or return errors about connection refused. The status dot in the nav bar shows red.

**Solution**:
1. Verify Ollama is installed **on the server**: \`ollama --version\`
2. Start the server: \`ollama serve\`
3. Check it is running: \`curl http://localhost:11434/api/tags\`
4. Ensure the model is downloaded: \`ollama list\`
5. If the port is different, update the Ollama URL in Settings > RAG
6. The nav bar status dot should turn green when Ollama is connected

**Note**: Ollama only needs to run on the machine hosting the app. All AI requests are proxied through the app server, so remote clients (phones, tablets, other computers) do not need Ollama installed.

### Voice Not Working in Firefox

**Symptom**: Microphone button does not respond or speech is not recognized.

**Solution**:
- Firefox has limited Web Speech API support. For best results, use Chrome or a Chromium-based browser.
- Ensure microphone permissions are granted in browser settings (about:preferences#privacy)
- Check that no other application is using the microphone exclusively

### Performance Tips

- **Large note collections**: If the app feels slow with many notes, try closing unused browser tabs to free memory
- **Knowledge graph**: Large graphs (500+ nodes) may benefit from disabling physics simulation in the graph controls
- **Embeddings**: Initial embedding generation runs in a Web Worker and may take a moment for large note collections. Subsequent updates are incremental.
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
