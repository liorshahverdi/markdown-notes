# Product Pivot Plan: Intelligent Markdown Notes, Memory Graph, and Agent Skills

Status update: this plan now describes the active product direction. The default chat path is notes + graph memory, the generated wiki/source subsystem is experimental/opt-in, and the graph review queue exists but is not yet a primary UX workflow.

## Executive summary

The application should pivot back to its original center of gravity: a local-first markdown notes app with Mermaid support, an automatically populated knowledge graph, local-model-assisted relationship discovery, intelligent chat memory recall, and generation of reusable agent skills from graph connections.

The Karpathy-style LLM wiki work is not wasted, but it should become an experimental or derived subsystem. The canonical source of truth should be user-authored notes, not generated wiki pages or ingestion logs.

Target product statement:

> I write markdown notes and diagrams. The app builds a living local knowledge graph from them, lets me chat with that memory, and can turn meaningful graph connections into reusable agent skills.

## Current codebase inventory

### Core note-taking foundation already exists

Relevant files:

- `web/src/routes/+page.svelte`
- `web/src/lib/components/Editor.svelte`
- `web/src/lib/components/Preview.svelte`
- `web/src/lib/components/Toolbar.svelte`
- `web/src/lib/components/StatusBar.svelte`
- `web/src/lib/stores/notes.ts`
- `web/src/lib/stores/folders.ts`
- `web/src/routes/api/notes/+server.ts`
- `web/src/lib/server/notesFile.ts`

Current capabilities:

- Markdown editing with CodeMirror.
- Markdown preview.
- Mermaid rendering/export in preview.
- Toolbar actions for markdown constructs, tables, diagrams, images.
- Folder/file organization.
- Server-backed note persistence in SQLite.
- Auto-save, dirty-note protection, and visible save status.
- Shared-note read-only support.

Needed changes:

- Keep notes as the canonical data model.
- Make note save/conflict behavior more explicit in the UI.
- Replace any remaining product language that implies the generated wiki is primary.
- Add stronger recovery UX for failed saves and conflicts.

### Markdown and Mermaid support exists

Relevant files:

- `web/src/lib/markdown/renderer.ts`
- `web/src/lib/markdown/diagramTemplates.ts`
- `web/src/lib/markdown/diagramExporter.ts`
- `web/src/lib/components/Preview.svelte`

Current capabilities:

- Markdown rendering with GFM.
- Mermaid code block rendering.
- Mermaid SVG/PNG export.
- Diagram templates.
- Sanitized markdown output.
- Lazy Mermaid loading.

Needed changes:

- Improve Mermaid editing workflow: insert at cursor, edit diagram templates, validate Mermaid syntax, preserve diagram-specific errors without breaking preview.
- Make diagram nodes/entities feed into graph extraction where possible.
- Add tests around Mermaid rendering failure handling.

### Knowledge graph implementation exists

Relevant files:

- `web/src/lib/stores/graph.ts`
- `web/src/lib/graph/entityExtractor.ts`
- `web/src/lib/graph/extractionPipeline.ts`
- `web/src/lib/graph/relationshipDiscoverer.ts`
- `web/src/lib/graph/implicitExtractor.ts`
- `web/src/lib/graph/cooccurrence.ts`
- `web/src/lib/graph/transitiveInference.ts`
- `web/src/lib/graph/graphBuilder.ts`
- `web/src/lib/graph/graphRetriever.ts`
- `web/src/lib/components/KnowledgeGraph.svelte`
- `web/src/routes/experimental/knowledge-graph/+page.svelte`

Current capabilities:

- Entity extraction from notes.
- Relationship extraction and graph construction.
- Graph analytics/visualization components.
- Implicit relationship extraction using a local model path.
- Experimental graph UI.

Needed changes:

- Promote graph from experimental feature to a primary product capability once stable.
- Track edge provenance consistently:
  - source note IDs
  - source excerpts
  - extraction method: regex, co-occurrence, NER, LLM, user-created
  - confidence
  - timestamp/version
- Add graph refresh status and explainability UI.
- Avoid silent graph mutation where the model invents connections without evidence.
- Let users accept/reject low-confidence inferred edges.

### RAG/chat memory exists but should be refocused

Relevant files:

- `web/src/lib/components/ChatPanel.svelte`
- `web/src/lib/vector/ragPipeline.ts`
- `web/src/lib/vector/vectorStoreManager.ts`
- `web/src/lib/vector/vectorStore.ts`
- `web/src/lib/vector/serverEmbeddings.ts`
- `web/src/routes/api/query/+server.ts`
- `web/src/routes/api/ollama/*`
- `web/src/lib/llm/ollamaProxy.ts`

Current capabilities:

- Ollama integration.
- Embeddings and vector search.
- Chat panel.
- Wiki-first query context currently exists.
- Local model fallback paths exist.

Needed changes:

- Replace “wiki-first” retrieval as the default with “notes + graph memory” retrieval.
- Retrieval should combine:
  1. full-text note search
  2. vector search over note chunks
  3. graph neighborhood expansion
  4. recent chat context where relevant
  5. source citations back to notes and graph edges
- Keep generated wiki context as optional fallback/experimental mode only.
- Chat should answer: “I remember this because of these notes/entities/edges.”

### Agent skill generation exists and should become a top-level goal

Relevant files:

- `web/src/lib/skills/skillTemplate.ts`
- `web/src/lib/skills/skillGenerator.ts`
- `web/src/lib/skills/clusterDetector.ts`
- `web/src/lib/skills/bridgeDetector.ts`
- `web/src/lib/skills/skillCombiner.ts`
- `web/src/lib/skills/evidenceLinker.ts`
- `web/src/lib/skills/skillDependencyGraph.ts`
- `web/src/lib/stores/skills.ts`
- `web/src/lib/components/SkillCandidateCard.svelte`
- `web/src/lib/components/SkillGeneratorPanel.svelte`
- `web/src/lib/components/SkillList.svelte`
- `web/src/lib/components/SkillCombinePanel.svelte`
- `web/src/lib/components/SkillDependencyGraph.svelte`
- `web/src/lib/components/SkillEvidenceAnnotation.svelte`

Current capabilities:

- Detect graph clusters as skill candidates.
- Score clusters.
- Generate markdown skill documents with a local model.
- Save skill records in IndexedDB.
- Combine skills.
- Visualize skill dependencies.

Needed changes:

- Make skill generation an intentional workflow from selected graph nodes/edges, not only clusters.
- Support generating skills from:
  - a single high-value graph connection
  - a selected subgraph
  - a cluster
  - a bridge between clusters
  - multiple existing skills
- Store skills as markdown files or note-like records, not only IndexedDB records.
- Add provenance from skill sections back to notes/entities/edges.
- Define an export target for agent harnesses, e.g. `SKILL.md` format.

### LLM wiki subsystem exists but should be demoted

Relevant files:

- `web/src/lib/wiki/**`
- `web/src/routes/api/wiki/**`
- `web/src/routes/api/migration/notes-to-sources/+server.ts`
- `web/src/lib/components/WikiIndexView.svelte`
- `web/src/lib/components/WikiLogView.svelte`
- `web/src/lib/components/LintFindingsPanel.svelte`
- `web/src/lib/components/LegacyMigrationPanel.svelte`
- `web/src/routes/maintenance/+page.svelte`

Current capabilities:

- Raw source ingestion.
- Generated wiki pages.
- Wiki mutations/logging.
- Wiki linting/health.
- File-answer-to-wiki workflow.
- Maintenance route for operational panels.

Needed changes:

- Keep under `/maintenance` or move to `/experimental/wiki`.
- Remove from the main homepage and primary user flow.
- Treat generated wiki pages as optional derived artifacts from notes/graph, not the canonical memory.
- Do not require users to understand raw sources, mutations, or ingest review to use the main app.

## Desired architecture

### Principle 1: Notes are canonical

Canonical data:

```txt
User-authored notes
Markdown content
Mermaid diagrams
Folders/files
User-approved graph edits
User-approved skills
```

Derived data:

```txt
Embeddings
Chunks
Entities
Relations
Summaries
Graph clusters
Skill candidates
Generated wiki pages
```

### Principle 2: Graph is the semantic memory layer

The graph should not just visualize notes. It should power recall, discovery, and skill generation.

Graph node types:

- Note
- Entity
- Concept
- Person
- Organization
- Location
- Tool/API/library
- Mermaid diagram node
- Skill

Graph edge types:

- mentions
- defines
- depends_on
- causes
- implements
- contrasts_with
- related_to
- inferred_by_model
- used_by_skill
- derived_from

Every edge should support:

```ts
{
  id: string;
  from: string;
  to: string;
  type: string;
  confidence: number;
  provenance: Array<{
    noteId: string;
    excerpt?: string;
    method: 'regex' | 'ner' | 'cooccurrence' | 'llm' | 'user' | 'diagram';
  }>;
  accepted?: boolean;
}
```

### Principle 3: Chat recall uses notes + graph together

Default memory retrieval pipeline:

```txt
User query
→ normalize query
→ search note titles/content
→ vector search note chunks
→ extract query entities
→ retrieve matching graph nodes
→ expand graph neighborhood
→ rerank note chunks + graph evidence
→ answer using local model
→ cite notes and graph edges
```

The chat should be able to say:

- “I found this in note X.”
- “This is connected to Y through edge Z.”
- “This relation was inferred and has medium confidence.”
- “I do not have enough evidence in your notes.”

### Principle 4: Agent skills are generated from graph evidence

A skill is a reusable markdown instruction artifact distilled from connected knowledge.

Skill generation inputs:

- selected graph nodes
- selected graph edges
- graph cluster
- bridge opportunity between clusters
- manually selected notes
- prior generated skills

Skill generation output:

```txt
skills/<slug>/SKILL.md
skills/<slug>/metadata.json
```

Suggested `SKILL.md` structure:

```md
# Skill Name

## Purpose
When and why to use this skill.

## Trigger Conditions
Specific user requests, file patterns, graph patterns, or domain cues.

## Instructions
Step-by-step behavior for an agent.

## Knowledge Base
Condensed domain knowledge.

## Examples
Concrete examples from notes.

## Evidence
- Note: ...
- Entity: ...
- Edge: ...

## Limits
What this skill should not assume.
```

## Product navigation proposal

Primary navigation:

- Files
- Graph
- Chat
- Skills
- Help

Secondary/experimental navigation:

- Maintenance
- Experimental Wiki
- Graph Diagnostics

Homepage when no note is selected:

- recent files
- quick create note
- graph insights
- skill candidates
- chat entry point

Avoid showing maintenance panels by default.

## Phased implementation plan

### Phase 0: Stabilize current app

Goal: make the current notes app trustworthy.

Tasks:

- Confirm save/conflict behavior with tests and UI.
- Add recovery path for failed saves.
- Add Mermaid rendering error UI.
- Keep wiki panels off the homepage.
- Document that wiki is experimental.

Success criteria:

- User can write and reopen notes without data loss.
- Diagrams render or show actionable errors.
- App feels like a notes app, not an ingestion admin console.

### Phase 1: Recenter retrieval on notes

Goal: chat memory recalls from notes and graph, not generated wiki by default.

Tasks:

- Create a `noteMemoryPipeline` separate from wiki query pipeline.
- Combine vector search, full-text search, and graph expansion.
- Return citations to notes and graph edges.
- Add tests for retrieval ranking and citation output.
- Add a setting to enable/disable experimental wiki context.

Success criteria:

- Chat reliably recalls relevant notes.
- Answers cite note titles/excerpts.
- Graph connections improve recall over vector-only search.

### Phase 2: Make the graph explainable and editable

Goal: graph becomes trustworthy semantic infrastructure.

Tasks:

- Add edge provenance model.
- Store confidence and extraction method.
- Show “why this edge exists” in graph UI.
- Add review queue for model-inferred edges.
- Let users accept/reject/edit edges.
- Extract diagram nodes/edges from Mermaid blocks where feasible.

Success criteria:

- Every important edge can be explained.
- Users can correct the graph.
- The graph visibly improves chat and skill generation.

### Phase 3: Promote skill generation

Goal: generate agent skills from graph connections.

Tasks:

- Add `/skills` route as a first-class page.
- Allow selecting graph nodes/edges and sending them to skill generation.
- Generate skills from single edge, subgraph, cluster, or bridge.
- Store generated skills as markdown artifacts with metadata.
- Link skills back into the graph.
- Add approve/reject/regenerate workflow.
- Add tests for skill prompt construction, evidence linking, and persistence.

Success criteria:

- User can select a meaningful graph connection and generate a skill.
- Skill has citations/evidence from notes and graph edges.
- Skill can be exported/imported as markdown.

### Phase 4: Optional wiki as derived export

Goal: preserve the useful parts of the LLM wiki idea without making it the product core.

Tasks:

- Move wiki workflows under `/experimental/wiki` or keep them in `/maintenance`.
- Generate wiki pages from notes/graph on demand.
- Treat wiki pages as export/cache, not canonical state.
- Remove wiki-first retrieval from default chat.

Success criteria:

- Users can ignore wiki entirely.
- Advanced users can generate a wiki view if desired.
- No main workflow depends on raw source ingestion or mutation logs.

## Technical change list

### Routes and navigation

Add or promote:

- `/graph`
- `/chat` or persistent chat panel
- `/skills`
- `/maintenance`
- `/experimental/wiki`

Reduce prominence of:

- wiki index/log
- ingest review
- legacy migration
- mutation logs

### Data model

Add or evolve:

- graph edge provenance
- graph edge confidence
- graph edge accepted/rejected state
- skill markdown persistence
- skill provenance references
- note chunk metadata for retrieval

### Retrieval

Create:

- `noteMemoryPipeline.ts`
- `graphMemoryRetriever.ts`
- `memoryCitation.ts`

Deprecate as default:

- wiki-first query pipeline

### Skill generation

Extend:

- `skillGenerator.ts` to support graph selections beyond clusters
- `skillTemplate.ts` for agent-harness-compatible `SKILL.md`
- `evidenceLinker.ts` to cite notes/entities/edges
- `skillExporter.ts` to write markdown + metadata

### UI

Add:

- graph edge detail panel
- edge review queue
- skill candidate panel on graph page
- skill generation wizard
- skill evidence viewer
- chat citation viewer with graph context

## Testing strategy

Use TDD for each step.

High-value tests:

- note save conflict tests
- markdown/Mermaid rendering tests
- graph extraction provenance tests
- graph expansion retrieval tests
- chat memory citation tests
- skill prompt construction tests
- skill evidence linking tests
- skill markdown export tests
- UI tests for accept/reject graph edges

## What to avoid

- Do not make generated wiki pages the source of truth.
- Do not require users to understand ingestion/mutation internals.
- Do not silently mutate the graph with low-confidence model output.
- Do not generate skills without evidence citations.
- Do not let chat answer from ungrounded model memory when note evidence is missing.

## North-star workflow

```txt
1. User writes markdown notes and Mermaid diagrams.
2. App extracts entities and relationships.
3. Local model suggests deeper graph connections.
4. User reviews/accepts important inferred edges.
5. Chat recalls information using notes + graph.
6. User selects a graph connection or cluster.
7. App generates an agent skill with citations.
8. Skill becomes a reusable markdown artifact and graph node.
```

This preserves the useful parts of the LLM wiki idea while returning the product to the stronger original vision: a local-first intelligent notes system that turns personal knowledge into graph-powered memory and reusable agent skills.
