# Implementation Plan: Graph Edge Detail Drawer and Multi-step Skill Wizard

Status: planned/partially supported by lower-level graph provenance and edge review helpers. The current app has a review queue, but it is underused and should not be the primary graph workflow. Near-term graph UX work should emphasize exploration, evidence, and clear edge explanations first; accept/reject review should appear contextually from an edge detail drawer.

## Feature 1: Graph edge detail drawer

### Goal
Let users inspect, trust, and correct graph edges from the graph UI.

### User stories
- As a user, I can click an edge and see why it exists.
- As a user, I can see source notes, excerpts, extraction method, confidence, and status.
- As a user, I can accept, reject, or edit low-confidence/model-inferred edges.
- As a user, I can send a meaningful edge directly into skill generation.

### Data required
Use the graph edge provenance model:

```ts
{
  id: string;
  fromEntityId: string;
  toEntityId: string;
  type: string;
  confidence?: number;
  provenance?: Array<{
    noteId: string;
    excerpt?: string;
    method: 'regex' | 'ner' | 'cooccurrence' | 'llm' | 'user' | 'diagram';
  }>;
  accepted?: boolean;
  rejected?: boolean;
  createdAt?: number;
  updatedAt?: number;
}
```

### UI scope
- Add edge selection support to `KnowledgeGraph.svelte`.
- Add `GraphEdgeDetailDrawer.svelte`.
- Drawer sections:
  - edge summary: `from --type--> to`
  - confidence/status badge
  - provenance list with note links and excerpts
  - extraction method labels
  - accept/reject/edit actions
  - “Generate skill from this edge” action
- Add review queue entry point for inferred/low-confidence edges.

### TDD checklist
- Edge selection emits selected edge ID.
- Drawer renders edge endpoints, type, confidence, and provenance.
- Drawer links provenance back to source notes.
- Accept/reject actions update graph relation state without mutating unrelated edges.
- Rejected edges are hidden from normal retrieval unless diagnostics are enabled.
- “Generate skill from edge” passes selected edge and endpoint nodes to skill prompt builder.

## Feature 2: Multi-step skill generation wizard

### Goal
Make skill generation an intentional review workflow from graph evidence.

### User stories
- As a user, I can choose a generation input type: edge, selected subgraph, cluster, bridge, notes, or existing skills.
- As a user, I can review included evidence before generation.
- As a user, I can generate, edit, approve, reject, or regenerate a skill.
- As a user, I can export approved skills as `skills/<slug>/SKILL.md` and `metadata.json`.

### Wizard steps
1. **Choose source**
   - single edge
   - selected nodes/edges
   - graph cluster
   - bridge opportunity
   - notes
   - existing skills
2. **Review evidence**
   - notes
   - entities
   - edges
   - excerpts
   - confidence/status
3. **Configure skill**
   - name
   - domain
   - trigger conditions
   - confidence target
   - export target
4. **Generate draft**
   - stream model output
   - enforce `SKILL.md` sections
   - require citations
5. **Review and approve**
   - edit markdown
   - approve/reject/regenerate
   - persist artifact files

### TDD checklist
- Wizard starts with selected graph edge/subgraph prefilled.
- Evidence review excludes rejected edges by default.
- Prompt builder includes only selected/cited evidence.
- Generated skill requires evidence section.
- Approve writes `SKILL.md` and `metadata.json` artifact payloads.
- Reject preserves no approved skill record.
- Regenerate keeps same evidence but creates a new version.

## Suggested implementation order
1. Add edge selection events and selected-edge store.
2. Build drawer component with mocked edge data tests.
3. Wire accept/reject/edit to graph store and IndexedDB persistence.
4. Add “Generate skill from edge” integration.
5. Build wizard state machine and tests.
6. Connect existing skill prompt/export primitives.
7. Add route-level integration tests.
