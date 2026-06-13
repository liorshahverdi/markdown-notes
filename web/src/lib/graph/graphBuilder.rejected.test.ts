import { describe, it, expect } from 'vitest';
import { buildGraphData } from './graphBuilder';
import type { GraphEntity, GraphRelation } from '../../types/graph';

const entities: GraphEntity[] = [
  { id: 'a', name: 'A', type: 'Other', sourceNoteIds: [] },
  { id: 'b', name: 'B', type: 'Other', sourceNoteIds: [] },
];

describe('buildGraphData rejected edge visibility', () => {
  it('hides rejected edges by default', () => {
    const relations: GraphRelation[] = [
      { id: 'r1', fromEntityId: 'a', toEntityId: 'b', type: 'related_to', rejected: true },
    ];

    expect(buildGraphData(entities, relations).edges).toEqual([]);
  });

  it('can include rejected edges for diagnostics', () => {
    const relations: GraphRelation[] = [
      { id: 'r1', fromEntityId: 'a', toEntityId: 'b', type: 'related_to', rejected: true },
    ];

    expect(buildGraphData(entities, relations, { includeRejected: true }).edges).toHaveLength(1);
  });
});
