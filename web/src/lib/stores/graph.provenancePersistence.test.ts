import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { db } from '../db/index';
import type { ExtractedRelation } from '../graph/entityExtractor';

vi.mock('../graph/extractionPipeline', () => ({
  runExtractionPipeline: vi.fn(async () => ({
    entities: [
      { name: 'Alpha', type: 'Object', confidence: 0.9 },
      { name: 'Beta', type: 'Object', confidence: 0.85 },
    ],
    relations: [
      {
        fromName: 'Alpha',
        toName: 'Beta',
        type: 'depends_on',
        method: 'diagram',
        excerpt: 'Alpha --> Beta',
        confidence: 0.9,
      } satisfies ExtractedRelation,
    ],
    stages: [],
  })),
}));

const graph = await import('./graph');

describe('graph store provenance persistence', () => {
  beforeEach(async () => {
    await db.entities.clear();
    await db.relations.clear();
    graph.graphEntities.set([]);
    graph.graphRelations.set([]);
    graph.graphNodes.set([]);
    graph.graphEdges.set([]);
  });

  it('persists extraction method, excerpt, confidence, and review status for extracted relations', async () => {
    await graph.extractAndSaveEntities(
      'note-1',
      'Diagram Note',
      '# Diagram Note\n\n```mermaid\ngraph TD\n  Alpha --> Beta\n```'
    );

    const relation = get(graph.graphRelations).find((edge) => edge.type === 'depends_on');
    expect(relation).toMatchObject({
      confidence: 0.9,
      accepted: true,
      rejected: false,
      provenance: [{ noteId: 'note-1', excerpt: 'Alpha --> Beta', method: 'diagram' }],
    });

    const persisted = await db.relations.get(relation!.id);
    expect(persisted).toMatchObject({
      confidence: 0.9,
      accepted: true,
      rejected: false,
      provenance: [{ noteId: 'note-1', excerpt: 'Alpha --> Beta', method: 'diagram' }],
    });
  });

  it('enriches existing extracted relations that were saved before provenance existed', async () => {
    await graph.extractAndSaveEntities(
      'note-1',
      'Diagram Note',
      '# Diagram Note\n\n```mermaid\ngraph TD\n  Alpha --> Beta\n```'
    );
    const relation = get(graph.graphRelations).find((edge) => edge.type === 'depends_on')!;
    const legacyRelation = {
      id: relation.id,
      fromEntityId: relation.fromEntityId,
      toEntityId: relation.toEntityId,
      type: relation.type,
      weight: 1,
    };
    await db.relations.put(legacyRelation);
    graph.graphRelations.set([legacyRelation]);

    await graph.extractAndSaveEntities(
      'note-1',
      'Diagram Note',
      '# Diagram Note\n\n```mermaid\ngraph TD\n  Alpha --> Beta\n```'
    );

    expect(get(graph.graphRelations).find((edge) => edge.type === 'depends_on')).toMatchObject({
      confidence: 0.9,
      accepted: true,
      rejected: false,
      provenance: [{ noteId: 'note-1', excerpt: 'Alpha --> Beta', method: 'diagram' }],
    });
  });
});
