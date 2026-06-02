import { describe, it, expect } from 'vitest';
import { computeGraphAnalytics } from './analyticsComputer';
import type { GraphEntity, GraphRelation } from '../../types/graph';

function makeEntity(
  id: string,
  type: GraphEntity['type'] = 'Other',
  noteIds: string[] = ['n1']
): GraphEntity {
  return { id, name: id, type, sourceNoteIds: noteIds };
}

function makeRelation(id: string, from: string, to: string): GraphRelation {
  return { id, fromEntityId: from, toEntityId: to, type: 'related_to' };
}

describe('computeGraphAnalytics', () => {
  it('returns zero metrics for empty graph', () => {
    const analytics = computeGraphAnalytics([], []);
    expect(analytics.totalNodes).toBe(0);
    expect(analytics.totalEdges).toBe(0);
    expect(analytics.totalClusters).toBe(0);
    expect(analytics.avgClusterSize).toBe(0);
    expect(analytics.entityDistribution.size).toBe(0);
    expect(analytics.overallModularity).toBe(0);
  });

  it('counts nodes and edges correctly', () => {
    const entities = [makeEntity('A'), makeEntity('B'), makeEntity('C')];
    const relations = [makeRelation('r1', 'A', 'B'), makeRelation('r2', 'B', 'C')];
    const analytics = computeGraphAnalytics(entities, relations);
    expect(analytics.totalNodes).toBe(3);
    expect(analytics.totalEdges).toBe(2);
  });

  it('computes entity distribution by type', () => {
    const entities = [
      makeEntity('A', 'Other'),
      makeEntity('B', 'Other'),
      makeEntity('C', 'Person'),
      makeEntity('D', 'Location'),
    ];
    const analytics = computeGraphAnalytics(entities, []);
    expect(analytics.entityDistribution.get('Other')).toBe(2);
    expect(analytics.entityDistribution.get('Person')).toBe(1);
    expect(analytics.entityDistribution.get('Location')).toBe(1);
  });

  it('computes cluster count and average size', () => {
    // Two disconnected clusters: {A, B} and {C, D}
    const entities = [makeEntity('A'), makeEntity('B'), makeEntity('C'), makeEntity('D')];
    const relations = [makeRelation('r1', 'A', 'B'), makeRelation('r2', 'C', 'D')];
    const analytics = computeGraphAnalytics(entities, relations);
    expect(analytics.totalClusters).toBe(2);
    expect(analytics.avgClusterSize).toBe(2);
  });

  it('treats isolated nodes as single-node clusters', () => {
    const entities = [makeEntity('A'), makeEntity('B')];
    const analytics = computeGraphAnalytics(entities, []);
    expect(analytics.totalClusters).toBe(2);
    expect(analytics.avgClusterSize).toBe(1);
  });

  it('computes overall modularity as average cluster modularity', () => {
    // Single fully connected cluster: modularity = 1
    const entities = [makeEntity('A'), makeEntity('B'), makeEntity('C')];
    const relations = [
      makeRelation('r1', 'A', 'B'),
      makeRelation('r2', 'B', 'C'),
      makeRelation('r3', 'A', 'C'),
    ];
    const analytics = computeGraphAnalytics(entities, relations);
    expect(analytics.overallModularity).toBeCloseTo(1, 2);
  });

  it('computes modularity for multiple clusters', () => {
    // Two completely separate clusters -> each has modularity 1 -> avg = 1
    const entities = [makeEntity('A'), makeEntity('B'), makeEntity('C'), makeEntity('D')];
    const relations = [makeRelation('r1', 'A', 'B'), makeRelation('r2', 'C', 'D')];
    const analytics = computeGraphAnalytics(entities, relations);
    expect(analytics.overallModularity).toBeCloseTo(1, 2);
  });

  it('handles single entity graph', () => {
    const entities = [makeEntity('A')];
    const analytics = computeGraphAnalytics(entities, []);
    expect(analytics.totalNodes).toBe(1);
    expect(analytics.totalEdges).toBe(0);
    expect(analytics.totalClusters).toBe(1);
    expect(analytics.avgClusterSize).toBe(1);
    expect(analytics.entityDistribution.get('Other')).toBe(1);
  });
});
