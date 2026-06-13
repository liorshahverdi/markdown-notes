import { describe, expect, it } from 'vitest';
import { buildGraphSnapshot } from './graphSnapshot';
import type { NoteRecord } from '../../types/note';

const note: NoteRecord = {
  id: 'note-1',
  title: 'System Architecture',
  content: `# System Architecture

The app is built with SvelteKit.

\`\`\`mermaid
graph TD
  Editor --> Preview
  Preview --> Graph
\`\`\`
`,
  dateModified: 100,
  isPinned: false,
};

describe('buildGraphSnapshot provenance', () => {
  it('attaches evidence, confidence, method, and timestamp metadata to extracted edges', () => {
    const snapshot = buildGraphSnapshot([note], []);
    const relation = snapshot.relations.find((edge) => edge.type === 'mentioned_in');

    expect(relation).toBeTruthy();
    expect(relation?.confidence).toBeGreaterThan(0);
    expect(relation?.accepted).toBe(true);
    expect(relation?.provenance?.[0]).toMatchObject({
      noteId: 'note-1',
      method: 'regex',
    });
    expect(relation?.provenance?.[0]?.excerpt).toContain('built with SvelteKit');
    expect(typeof relation?.createdAt).toBe('number');
  });

  it('extracts Mermaid diagram nodes and edges with diagram provenance', () => {
    const snapshot = buildGraphSnapshot([note], []);
    const names = snapshot.entities.map((entity) => entity.name);

    expect(names).toContain('Editor');
    expect(names).toContain('Preview');
    expect(names).toContain('Graph');

    const diagramEdge = snapshot.relations.find((edge) => {
      const from = snapshot.entities.find((entity) => entity.id === edge.fromEntityId)?.name;
      const to = snapshot.entities.find((entity) => entity.id === edge.toEntityId)?.name;
      return from === 'Editor' && to === 'Preview';
    });

    expect(diagramEdge).toMatchObject({
      type: 'depends_on',
      confidence: 0.9,
      accepted: true,
    });
    expect(diagramEdge?.provenance?.[0]).toMatchObject({
      noteId: 'note-1',
      method: 'diagram',
    });
  });
});
