import { describe, it, expect } from 'vitest';
import { computeGraphHealth, findOrphans } from './graphScorer';
import type { GraphEntity, GraphRelation } from '../../types/graph';

function makeEntity(id: string, noteIds: string[] = ['n1']): GraphEntity {
  return { id, name: id, type: 'Other', sourceNoteIds: noteIds };
}

function makeRelation(id: string, from: string, to: string): GraphRelation {
  return { id, fromEntityId: from, toEntityId: to, type: 'related_to' };
}

describe('graphScorer', () => {
  describe('computeGraphHealth', () => {
    it('returns zero metrics for empty graph', () => {
      const health = computeGraphHealth([], []);
      expect(health.totalNodes).toBe(0);
      expect(health.totalEdges).toBe(0);
      expect(health.overallScore).toBe(0);
      expect(health.connectivity).toBe(0);
    });

    it('computes correct node and edge counts', () => {
      const entities = [makeEntity('A'), makeEntity('B'), makeEntity('C')];
      const relations = [makeRelation('r1', 'A', 'B'), makeRelation('r2', 'B', 'C')];
      const health = computeGraphHealth(entities, relations);
      expect(health.totalNodes).toBe(3);
      expect(health.totalEdges).toBe(2);
    });

    it('computes connectivity ratio', () => {
      // 3 nodes → max edges = 3*(3-1)/2 = 3
      // 2 edges → connectivity = 2/3
      const entities = [makeEntity('A'), makeEntity('B'), makeEntity('C')];
      const relations = [makeRelation('r1', 'A', 'B'), makeRelation('r2', 'B', 'C')];
      const health = computeGraphHealth(entities, relations);
      expect(health.connectivity).toBeCloseTo(2 / 3, 3);
    });

    it('counts orphan entities (only 1 relation)', () => {
      const entities = [makeEntity('A'), makeEntity('B'), makeEntity('C')];
      // A-B: A has 1 relation, B has 2, C has 1
      const relations = [makeRelation('r1', 'A', 'B'), makeRelation('r2', 'B', 'C')];
      const health = computeGraphHealth(entities, relations);
      expect(health.orphanCount).toBe(2); // A and C
    });

    it('returns overall score between 0 and 100', () => {
      const entities = [makeEntity('A'), makeEntity('B')];
      const relations = [makeRelation('r1', 'A', 'B')];
      const health = computeGraphHealth(entities, relations);
      expect(health.overallScore).toBeGreaterThanOrEqual(0);
      expect(health.overallScore).toBeLessThanOrEqual(100);
    });

    it('computes cluster metrics', () => {
      // Two disconnected clusters: {A,B} and {C,D}
      const entities = [makeEntity('A'), makeEntity('B'), makeEntity('C'), makeEntity('D')];
      const relations = [makeRelation('r1', 'A', 'B'), makeRelation('r2', 'C', 'D')];
      const health = computeGraphHealth(entities, relations);
      expect(health.totalClusters).toBe(2);
      expect(health.avgClusterSize).toBe(2);
    });
  });

  describe('findOrphans', () => {
    it('returns entities with only 1 relation', () => {
      const entities = [makeEntity('A'), makeEntity('B'), makeEntity('C')];
      const relations = [makeRelation('r1', 'A', 'B'), makeRelation('r2', 'B', 'C')];
      const orphans = findOrphans(entities, relations);
      const orphanIds = orphans.map((e) => e.id);
      expect(orphanIds).toContain('A');
      expect(orphanIds).toContain('C');
      expect(orphanIds).not.toContain('B');
    });

    it('includes entities with zero relations', () => {
      const entities = [makeEntity('A'), makeEntity('B')];
      const relations: GraphRelation[] = [];
      const orphans = findOrphans(entities, relations);
      expect(orphans).toHaveLength(2);
    });

    it('returns empty when all entities are well-connected', () => {
      const entities = [makeEntity('A'), makeEntity('B'), makeEntity('C')];
      const relations = [
        makeRelation('r1', 'A', 'B'),
        makeRelation('r2', 'B', 'C'),
        makeRelation('r3', 'A', 'C'),
      ];
      const orphans = findOrphans(entities, relations);
      expect(orphans).toHaveLength(0);
    });
  });
});
