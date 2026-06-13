import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { db } from '../db/index';
import {
  acceptRelation,
  graphEdges,
  graphEntities,
  graphRelations,
  rejectRelation,
  selectedEdgeId,
} from './graph';
import type { GraphEntity, GraphRelation } from '../../types/graph';

const entities: GraphEntity[] = [
  { id: 'a', name: 'A', type: 'Other', sourceNoteIds: [] },
  { id: 'b', name: 'B', type: 'Other', sourceNoteIds: [] },
  { id: 'c', name: 'C', type: 'Other', sourceNoteIds: [] },
];

const relations: GraphRelation[] = [
  { id: 'r1', fromEntityId: 'a', toEntityId: 'b', type: 'related_to', confidence: 0.4 },
  { id: 'r2', fromEntityId: 'b', toEntityId: 'c', type: 'depends_on', confidence: 0.9 },
];

describe('graph relation review state', () => {
  beforeEach(async () => {
    await db.relations.clear();
    graphEntities.set(entities);
    graphRelations.set(relations);
    selectedEdgeId.set(null);
  });

  it('accepts an edge without mutating unrelated edges', async () => {
    await acceptRelation('r1');

    expect(get(graphRelations).find((r) => r.id === 'r1')).toMatchObject({ accepted: true, rejected: false });
    expect(get(graphRelations).find((r) => r.id === 'r2')).toMatchObject(relations[1]);
    expect(await db.relations.get('r1')).toMatchObject({ accepted: true, rejected: false });
  });

  it('rejects and hides an edge from normal graph retrieval', async () => {
    selectedEdgeId.set('r1');

    await rejectRelation('r1');

    expect(get(selectedEdgeId)).toBeNull();
    expect(get(graphEdges).map((edge) => edge.id)).not.toContain('r1');
    expect(get(graphRelations).find((r) => r.id === 'r2')).toMatchObject(relations[1]);
  });
});
