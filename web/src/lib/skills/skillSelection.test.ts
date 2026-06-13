import { describe, expect, it } from 'vitest';
import { buildSkillPromptFromSelection } from './skillGenerator';
import { buildSkillArtifactFiles } from './skillExporter';
import type { GraphEntity, GraphRelation } from '../../types/graph';

const entities: GraphEntity[] = [
  { id: 'e1', name: 'SvelteKit', type: 'Object', sourceNoteIds: ['n1'] },
  { id: 'e2', name: 'Local-first Notes', type: 'Other', sourceNoteIds: ['n1', 'n2'] },
];

const relations: GraphRelation[] = [
  {
    id: 'r1',
    fromEntityId: 'e1',
    toEntityId: 'e2',
    type: 'implements',
    confidence: 0.82,
    accepted: true,
    provenance: [{ noteId: 'n1', excerpt: 'SvelteKit implements local-first notes.', method: 'user' }],
  },
];

const notes = [
  { id: 'n1', title: 'Architecture', content: 'SvelteKit implements local-first notes.' },
  { id: 'n2', title: 'Notes Workflow', content: 'Write markdown and keep citations.' },
];

describe('skill generation from graph selections', () => {
  it('builds a SKILL.md-compatible prompt from selected nodes and edges with evidence requirements', () => {
    const prompt = buildSkillPromptFromSelection({
      name: 'Local-first SvelteKit Notes',
      selectedEntityIds: ['e1', 'e2'],
      selectedRelationIds: ['r1'],
      entities,
      relations,
      notes,
    });

    expect(prompt).toContain('Generate a SKILL.md artifact');
    expect(prompt).toContain('## Purpose');
    expect(prompt).toContain('SvelteKit --implements--> Local-first Notes');
    expect(prompt).toContain('SvelteKit implements local-first notes.');
    expect(prompt).toContain('[Note: "Architecture"]');
    expect(prompt).toContain('Do not include claims without evidence');
  });

  it('exports approved skills as skills/<slug>/SKILL.md and metadata.json artifacts', () => {
    const files = buildSkillArtifactFiles({
      id: 'skill-1',
      name: 'Local-first SvelteKit Notes',
      domain: 'notes',
      type: 'single',
      content: '# Local-first SvelteKit Notes\n\n## Evidence\n- [Note: "Architecture"]',
      sourceNoteIds: ['n1'],
      parentSkillIds: [],
      dependencies: { requires: [], enhances: [] },
      confidence: 'high',
      versions: [],
      createdAt: 1,
      updatedAt: 2,
    });

    expect(files.map((file) => file.path)).toEqual([
      'skills/local-first-sveltekit-notes/SKILL.md',
      'skills/local-first-sveltekit-notes/metadata.json',
    ]);
    expect(files[0].content).toContain('# Local-first SvelteKit Notes');
    expect(JSON.parse(files[1].content)).toMatchObject({
      id: 'skill-1',
      slug: 'local-first-sveltekit-notes',
      sourceNoteIds: ['n1'],
    });
  });
});
