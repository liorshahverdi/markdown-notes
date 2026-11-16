import { describe, expect, it } from 'vitest';
import { formatGraphEvidence, graphEdgeQuality, retrieveGraphMemory } from './graphMemoryRetriever';
import type { GraphEntity, GraphRelation } from '../../types/graph';

const entities: GraphEntity[] = [
  { id: 'a', name: 'Billing', type: 'Object', sourceNoteIds: ['n1'] },
  { id: 'b', name: 'Ledger', type: 'Object', sourceNoteIds: ['n1'] },
];

function rel(id: string, reviewState: string, extra: Partial<GraphRelation> = {}): GraphRelation {
  return { id, fromEntityId: 'a', toEntityId: 'b', type: 'depends_on', confidence: 0.9, metadata: { reviewState }, ...extra };
}

describe('graph memory quality ranking', () => {
  it('ranks accepted above base above unreviewed automatic edges', () => {
    expect(graphEdgeQuality(rel('1', 'accepted'))).toBeGreaterThan(graphEdgeQuality(rel('2', 'base')));
    expect(graphEdgeQuality(rel('2', 'base'))).toBeGreaterThan(graphEdgeQuality(rel('3', 'auto')));
    expect(graphEdgeQuality(rel('4', 'base', { provenance: [{ noteId: 'n1', method: 'regex' }] }))).toBeGreaterThan(graphEdgeQuality(rel('2', 'base')));
  });

  it('excludes pending and ephemeral edges and labels unreviewed ones', () => {
    const evidence = retrieveGraphMemory({
      notes: [],
      folders: [],
      query: 'billing ledger',
      graph: { entities, relations: [rel('p', 'pending'), rel('e', 'ephemeral'), rel('auto', 'auto')] },
    });
    expect(evidence.map((item) => item.relation.id)).toEqual(['auto']);
    expect(formatGraphEvidence(evidence)).toContain('[unreviewed model suggestion]');
  });
});
