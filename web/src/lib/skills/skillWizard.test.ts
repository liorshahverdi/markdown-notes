import { describe, expect, it } from 'vitest';
import {
  createEdgeWizardSource,
  buildFocusedNodeSkillCluster,
  buildSkillPromptFromWizardEvidence,
  createApprovedSkillArtifacts,
} from './skillWizard';
import type { GraphEntity, GraphRelation } from '../../types/graph';

const entities: GraphEntity[] = [
  { id: 'a', name: 'Alpha', type: 'Other', sourceNoteIds: ['n1'] },
  { id: 'b', name: 'Beta', type: 'Other', sourceNoteIds: ['n2'] },
  { id: 'c', name: 'Gamma', type: 'Other', sourceNoteIds: [] },
];

const edge: GraphRelation = {
  id: 'e1',
  fromEntityId: 'a',
  toEntityId: 'b',
  type: 'depends_on',
  confidence: 0.42,
  provenance: [{ noteId: 'n1', excerpt: 'Alpha depends on Beta.', method: 'llm' }],
};

const rejected: GraphRelation = {
  id: 'e2',
  fromEntityId: 'b',
  toEntityId: 'c',
  type: 'related_to',
  rejected: true,
  provenance: [{ noteId: 'n2', excerpt: 'Rejected claim.', method: 'llm' }],
};

const notes = [
  { id: 'n1', title: 'Alpha note', content: 'Alpha depends on Beta.' },
  { id: 'n2', title: 'Rejected note', content: 'Rejected claim.' },
];

describe('skill wizard evidence helpers', () => {
  it('starts from a selected edge with both endpoint entities prefilled', () => {
    const source = createEdgeWizardSource(edge, entities);

    expect(source.type).toBe('edge');
    expect(source.selectedRelationIds).toEqual(['e1']);
    expect(source.selectedEntityIds).toEqual(['a', 'b']);
  });

  it('builds prompts from selected cited evidence and excludes rejected edges by default', () => {
    const prompt = buildSkillPromptFromWizardEvidence({
      name: 'Alpha Beta Skill',
      source: createEdgeWizardSource(edge, entities),
      entities,
      relations: [edge, rejected],
      notes,
    });

    expect(prompt).toContain('Alpha --depends_on--> Beta');
    expect(prompt).toContain('Alpha depends on Beta.');
    expect(prompt).toContain('## Evidence');
    expect(prompt).not.toContain('Rejected claim.');
  });

  it('builds a focused selected-node cluster without pulling unrelated notes through shared tags', () => {
    const selectedNodeEntities: GraphEntity[] = [
      { id: 'silver-note', name: 'Silver Index POC Notebook Documentation', type: 'note', sourceNoteIds: ['silver-note-id'] },
      { id: 'silver-tag', name: 'poc', type: 'Other', subtype: 'tag', sourceNoteIds: ['silver-note-id', 'java-note-id'] },
      { id: 'java-note', name: 'Java Cheat Sheet', type: 'note', sourceNoteIds: ['java-note-id'] },
    ];
    const selectedNodeRelations: GraphRelation[] = [
      { id: 'silver-poc', fromEntityId: 'silver-tag', toEntityId: 'silver-note', type: 'mentions' },
      { id: 'java-poc', fromEntityId: 'silver-tag', toEntityId: 'java-note', type: 'mentions' },
    ];

    const cluster = buildFocusedNodeSkillCluster({
      selectedEntityId: 'silver-note',
      entities: selectedNodeEntities,
      relations: selectedNodeRelations,
    });

    expect(cluster).toMatchObject({
      name: 'Silver Index POC Notebook Documentation',
      noteIds: ['silver-note-id'],
    });
    expect(cluster?.entityIds).toContain('silver-tag');
    expect(cluster?.entityIds).not.toContain('java-note');
    expect(cluster?.noteIds).not.toContain('java-note-id');
  });

  it('creates approved SKILL.md and metadata artifact payloads', () => {
    const artifacts = createApprovedSkillArtifacts({
      name: 'Alpha Beta Skill',
      domain: 'systems',
      markdown: '# Alpha Beta Skill\n\n## Evidence\n- [Note: "Alpha note"]',
      source: createEdgeWizardSource(edge, entities),
      approvedAt: 123,
    });

    expect(artifacts.skillPath).toBe('skills/alpha-beta-skill/SKILL.md');
    expect(artifacts.metadataPath).toBe('skills/alpha-beta-skill/metadata.json');
    expect(JSON.parse(artifacts.metadataJson)).toMatchObject({
      name: 'Alpha Beta Skill',
      domain: 'systems',
      sourceType: 'edge',
      relationIds: ['e1'],
    });
  });
});
