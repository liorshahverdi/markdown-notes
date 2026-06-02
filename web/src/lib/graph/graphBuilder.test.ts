import { describe, it, expect } from 'vitest';
import { buildGraphData } from './graphBuilder';
import type { GraphEntity, GraphRelation } from '../../types/graph';

describe('graphBuilder', () => {
  const makeEntity = (
    overrides: Partial<GraphEntity> & { id: string; name: string; type: GraphEntity['type'] }
  ): GraphEntity => ({
    sourceNoteIds: [],
    ...overrides,
  });

  const makeRelation = (
    overrides: Partial<GraphRelation> & {
      id: string;
      fromEntityId: string;
      toEntityId: string;
      type: GraphRelation['type'];
    }
  ): GraphRelation => ({
    ...overrides,
  });

  describe('node creation', () => {
    it('creates nodes from entities', () => {
      const entities: GraphEntity[] = [
        makeEntity({ id: '1', name: 'My Note', type: 'note', sourceNoteIds: [] }),
      ];
      const { nodes } = buildGraphData(entities, []);
      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toEqual({
        id: '1',
        label: 'My Note',
        group: 'note',
        title: 'note: My Note',
        size: 15,
      });
    });

    it('includes subtype in tooltip when present', () => {
      const entities: GraphEntity[] = [
        makeEntity({ id: '1', name: 'React', type: 'Other', sourceNoteIds: [] }),
      ];
      entities[0].subtype = 'topic';
      const { nodes } = buildGraphData(entities, []);
      expect(nodes[0].title).toBe('Other (topic): React');
    });

    it('assigns correct group for each entity type', () => {
      const types: GraphEntity['type'][] = [
        'note',
        'Person',
        'Object',
        'Location',
        'Event',
        'Other',
      ];
      const entities = types.map((type, i) =>
        makeEntity({ id: `${i}`, name: `Entity ${i}`, type, sourceNoteIds: [] })
      );
      const { nodes } = buildGraphData(entities, []);
      types.forEach((type, i) => {
        expect(nodes[i].group).toBe(type);
      });
    });

    it('scales node size based on source note count', () => {
      const entities: GraphEntity[] = [
        makeEntity({
          id: '1',
          name: 'Popular',
          type: 'Other',
          sourceNoteIds: ['a', 'b', 'c', 'd', 'e'],
        }),
        makeEntity({
          id: '2',
          name: 'Rare',
          type: 'Other',
          sourceNoteIds: ['a'],
        }),
      ];
      const { nodes } = buildGraphData(entities, []);
      expect(nodes[0].size).toBeGreaterThan(nodes[1].size!);
    });
  });

  describe('edge creation', () => {
    it('creates edges from relations', () => {
      const entities: GraphEntity[] = [
        makeEntity({ id: '1', name: 'Note A', type: 'note', sourceNoteIds: [] }),
        makeEntity({ id: '2', name: 'Topic X', type: 'Other', sourceNoteIds: [] }),
      ];
      const relations: GraphRelation[] = [
        makeRelation({
          id: 'r1',
          fromEntityId: '1',
          toEntityId: '2',
          type: 'mentions',
        }),
      ];
      const { edges } = buildGraphData(entities, relations);
      expect(edges).toHaveLength(1);
      expect(edges[0]).toEqual({
        id: 'r1',
        from: '1',
        to: '2',
        label: 'mentions',
        dashes: false,
        width: 1,
      });
    });

    it('marks transitive edges as dashed', () => {
      const entities: GraphEntity[] = [
        makeEntity({ id: '1', name: 'A', type: 'note', sourceNoteIds: [] }),
        makeEntity({ id: '2', name: 'B', type: 'note', sourceNoteIds: [] }),
      ];
      const relations: GraphRelation[] = [
        makeRelation({
          id: 'r1',
          fromEntityId: '1',
          toEntityId: '2',
          type: 'transitive',
        }),
      ];
      const { edges } = buildGraphData(entities, relations);
      expect(edges[0].dashes).toBe(true);
    });

    it('sets edge width based on weight', () => {
      const entities: GraphEntity[] = [
        makeEntity({ id: '1', name: 'A', type: 'note', sourceNoteIds: [] }),
        makeEntity({ id: '2', name: 'B', type: 'note', sourceNoteIds: [] }),
      ];
      const relations: GraphRelation[] = [
        makeRelation({
          id: 'r1',
          fromEntityId: '1',
          toEntityId: '2',
          type: 'mentions',
          weight: 5,
        }),
      ];
      const { edges } = buildGraphData(entities, relations);
      expect(edges[0].width).toBe(5);
    });
  });

  describe('empty input', () => {
    it('returns empty arrays for no input', () => {
      const { nodes, edges } = buildGraphData([], []);
      expect(nodes).toEqual([]);
      expect(edges).toEqual([]);
    });
  });
});
