import { describe, it, expect } from 'vitest';
import { computeClusterQualities } from './clusterMetrics';
import type { GraphEntity, GraphRelation } from '../../types/graph';
import type { Cluster } from '../skills/clusterDetector';

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

function makeCluster(
  id: string,
  name: string,
  entityIds: string[],
  noteIds: string[],
  density: number = 0.5,
  modularity: number = 0.8
): Cluster {
  return { id, name, entityIds, noteIds, density, modularity };
}

describe('computeClusterQualities', () => {
  it('returns empty array for no clusters', () => {
    const qualities = computeClusterQualities([], [], []);
    expect(qualities).toEqual([]);
  });

  it('computes entity count and note count correctly', () => {
    const cluster = makeCluster('c1', 'Test Cluster', ['A', 'B', 'C'], ['n1', 'n2']);
    const entities = [
      makeEntity('A', 'Other', ['n1']),
      makeEntity('B', 'Person', ['n1', 'n2']),
      makeEntity('C', 'Other', ['n2']),
    ];
    const relations = [makeRelation('r1', 'A', 'B'), makeRelation('r2', 'B', 'C')];
    const qualities = computeClusterQualities([cluster], entities, relations);
    expect(qualities).toHaveLength(1);
    expect(qualities[0].entityCount).toBe(3);
    expect(qualities[0].noteCount).toBe(2);
  });

  it('computes internal density for a cluster', () => {
    // 3 entities, 3 possible edges, 2 actual internal edges -> density = 2/3
    const cluster = makeCluster('c1', 'Dense', ['A', 'B', 'C'], ['n1']);
    const entities = [makeEntity('A'), makeEntity('B'), makeEntity('C')];
    const relations = [makeRelation('r1', 'A', 'B'), makeRelation('r2', 'B', 'C')];
    const qualities = computeClusterQualities([cluster], entities, relations);
    expect(qualities[0].internalDensity).toBeCloseTo(2 / 3, 3);
  });

  it('computes full density for fully connected cluster', () => {
    // 3 entities, 3 possible edges, 3 actual -> density = 1.0
    const cluster = makeCluster('c1', 'Full', ['A', 'B', 'C'], ['n1']);
    const entities = [makeEntity('A'), makeEntity('B'), makeEntity('C')];
    const relations = [
      makeRelation('r1', 'A', 'B'),
      makeRelation('r2', 'B', 'C'),
      makeRelation('r3', 'A', 'C'),
    ];
    const qualities = computeClusterQualities([cluster], entities, relations);
    expect(qualities[0].internalDensity).toBeCloseTo(1.0, 3);
  });

  it('handles single-entity cluster with zero density', () => {
    const cluster = makeCluster('c1', 'Single', ['A'], ['n1']);
    const entities = [makeEntity('A')];
    const qualities = computeClusterQualities([cluster], entities, []);
    expect(qualities[0].internalDensity).toBe(0);
    expect(qualities[0].entityCount).toBe(1);
  });

  it('preserves cluster id and name', () => {
    const cluster = makeCluster('c-special', 'My Cluster', ['A'], ['n1']);
    const entities = [makeEntity('A')];
    const qualities = computeClusterQualities([cluster], entities, []);
    expect(qualities[0].clusterId).toBe('c-special');
    expect(qualities[0].clusterName).toBe('My Cluster');
  });

  it('preserves modularity from cluster', () => {
    const cluster = makeCluster('c1', 'Test', ['A', 'B'], ['n1'], 0.5, 0.75);
    const entities = [makeEntity('A'), makeEntity('B')];
    const relations = [makeRelation('r1', 'A', 'B')];
    const qualities = computeClusterQualities([cluster], entities, relations);
    expect(qualities[0].modularity).toBeCloseTo(0.75, 3);
  });

  it('computes coverage as fraction of unique source notes in cluster', () => {
    // Cluster has 2 noteIds, but entities reference 3 unique notes total
    const cluster = makeCluster('c1', 'Cov', ['A', 'B'], ['n1', 'n2']);
    const entities = [
      makeEntity('A', 'Other', ['n1', 'n2', 'n3']),
      makeEntity('B', 'Person', ['n2']),
    ];
    const relations = [makeRelation('r1', 'A', 'B')];
    const qualities = computeClusterQualities([cluster], entities, relations);
    // Source notes from entities in cluster: n1, n2, n3 -> 3 unique
    // Cluster noteIds: n1, n2 -> 2
    // Coverage = 2/3
    expect(qualities[0].coverage).toBeCloseTo(2 / 3, 3);
  });

  it('handles multiple clusters', () => {
    const c1 = makeCluster('c1', 'Cluster1', ['A', 'B'], ['n1']);
    const c2 = makeCluster('c2', 'Cluster2', ['C', 'D'], ['n2']);
    const entities = [
      makeEntity('A', 'Other', ['n1']),
      makeEntity('B', 'Other', ['n1']),
      makeEntity('C', 'Person', ['n2']),
      makeEntity('D', 'Person', ['n2']),
    ];
    const relations = [makeRelation('r1', 'A', 'B'), makeRelation('r2', 'C', 'D')];
    const qualities = computeClusterQualities([c1, c2], entities, relations);
    expect(qualities).toHaveLength(2);
    expect(qualities[0].clusterId).toBe('c1');
    expect(qualities[1].clusterId).toBe('c2');
  });
});
