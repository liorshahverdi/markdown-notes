import { describe, it, expect } from 'vitest';
import type { GraphEntity, GraphRelation } from '../../types/graph';
import { detectClusters, scoreClusterAsSkillCandidate, type Cluster } from './clusterDetector';

function makeEntity(id: string, name: string, type: GraphEntity['type'] = 'Other', sourceNoteIds: string[] = ['n1']): GraphEntity {
  return { id, name, type, sourceNoteIds };
}

function makeRelation(id: string, from: string, to: string, weight = 1): GraphRelation {
  return { id, fromEntityId: from, toEntityId: to, type: 'related_to', weight };
}

describe('clusterDetector', () => {
  describe('detectClusters', () => {
    it('should return empty array for empty input', () => {
      const clusters = detectClusters([], []);
      expect(clusters).toEqual([]);
    });

    it('should detect a single cluster from fully connected entities', () => {
      const entities = [
        makeEntity('e1', 'TypeScript'),
        makeEntity('e2', 'JavaScript'),
        makeEntity('e3', 'Node.js'),
      ];
      const relations = [
        makeRelation('r1', 'e1', 'e2'),
        makeRelation('r2', 'e2', 'e3'),
        makeRelation('r3', 'e1', 'e3'),
      ];
      const clusters = detectClusters(entities, relations);
      expect(clusters).toHaveLength(1);
      expect(clusters[0].entityIds).toHaveLength(3);
      expect(clusters[0].entityIds).toContain('e1');
      expect(clusters[0].entityIds).toContain('e2');
      expect(clusters[0].entityIds).toContain('e3');
    });

    it('should detect two separate clusters from disconnected components', () => {
      const entities = [
        makeEntity('e1', 'TypeScript', 'Other', ['n1']),
        makeEntity('e2', 'JavaScript', 'Other', ['n1']),
        makeEntity('e3', 'Cooking', 'Other', ['n2']),
        makeEntity('e4', 'Recipes', 'Other', ['n2']),
      ];
      const relations = [
        makeRelation('r1', 'e1', 'e2'),
        makeRelation('r2', 'e3', 'e4'),
      ];
      const clusters = detectClusters(entities, relations);
      expect(clusters).toHaveLength(2);
    });

    it('should calculate density correctly for a complete graph', () => {
      const entities = [
        makeEntity('e1', 'A'),
        makeEntity('e2', 'B'),
        makeEntity('e3', 'C'),
      ];
      // Complete graph: 3 edges for 3 nodes
      const relations = [
        makeRelation('r1', 'e1', 'e2'),
        makeRelation('r2', 'e2', 'e3'),
        makeRelation('r3', 'e1', 'e3'),
      ];
      const clusters = detectClusters(entities, relations);
      expect(clusters).toHaveLength(1);
      // density = 3 / (3*2/2) = 3/3 = 1.0
      expect(clusters[0].density).toBeCloseTo(1.0);
    });

    it('should calculate density correctly for a sparse graph', () => {
      const entities = [
        makeEntity('e1', 'A'),
        makeEntity('e2', 'B'),
        makeEntity('e3', 'C'),
        makeEntity('e4', 'D'),
      ];
      // Only 3 edges to form a connected component, possible = 4*3/2 = 6
      const relations = [
        makeRelation('r1', 'e1', 'e2'),
        makeRelation('r2', 'e2', 'e3'),
        makeRelation('r3', 'e3', 'e4'),
      ];
      const clusters = detectClusters(entities, relations);
      expect(clusters).toHaveLength(1);
      // density = 3 / 6 = 0.5
      expect(clusters[0].density).toBeCloseTo(0.5);
    });

    it('should collect noteIds from entity sourceNoteIds', () => {
      const entities = [
        makeEntity('e1', 'A', 'Other', ['n1', 'n2']),
        makeEntity('e2', 'B', 'Other', ['n2', 'n3']),
      ];
      const relations = [makeRelation('r1', 'e1', 'e2')];
      const clusters = detectClusters(entities, relations);
      expect(clusters).toHaveLength(1);
      expect(clusters[0].noteIds).toContain('n1');
      expect(clusters[0].noteIds).toContain('n2');
      expect(clusters[0].noteIds).toContain('n3');
      expect(clusters[0].noteIds).toHaveLength(3);
    });

    it('should generate name from most-connected entities', () => {
      const entities = [
        makeEntity('e1', 'TypeScript'),
        makeEntity('e2', 'JavaScript'),
        makeEntity('e3', 'React'),
      ];
      const relations = [
        makeRelation('r1', 'e1', 'e2'),
        makeRelation('r2', 'e2', 'e3'),
        makeRelation('r3', 'e1', 'e3'),
      ];
      const clusters = detectClusters(entities, relations);
      expect(clusters[0].name).toBeTruthy();
      expect(typeof clusters[0].name).toBe('string');
    });

    it('should handle isolated entities (no relations) as single-entity clusters', () => {
      const entities = [
        makeEntity('e1', 'Solo'),
      ];
      const clusters = detectClusters(entities, []);
      expect(clusters).toHaveLength(1);
      expect(clusters[0].entityIds).toEqual(['e1']);
      // Single entity: density = 0 (no edges possible or special case)
      expect(clusters[0].density).toBe(0);
    });

    it('should calculate modularity', () => {
      const entities = [
        makeEntity('e1', 'A'),
        makeEntity('e2', 'B'),
        makeEntity('e3', 'C'),
        makeEntity('e4', 'D'),
      ];
      // Two connected components
      const relations = [
        makeRelation('r1', 'e1', 'e2'),
        makeRelation('r2', 'e3', 'e4'),
      ];
      const clusters = detectClusters(entities, relations);
      expect(clusters).toHaveLength(2);
      // Each cluster is fully separated => modularity should be high
      for (const c of clusters) {
        expect(c.modularity).toBeGreaterThanOrEqual(0);
        expect(c.modularity).toBeLessThanOrEqual(1);
      }
    });

    it('should assign unique ids to clusters', () => {
      const entities = [
        makeEntity('e1', 'A'),
        makeEntity('e2', 'B'),
        makeEntity('e3', 'C'),
      ];
      const relations = [
        makeRelation('r1', 'e1', 'e2'),
      ];
      // e3 is disconnected
      const clusters = detectClusters(entities, relations);
      const ids = clusters.map(c => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('scoreClusterAsSkillCandidate', () => {
    it('should return a number between 0 and 1', () => {
      const cluster: Cluster = {
        id: 'c1',
        entityIds: ['e1', 'e2', 'e3'],
        noteIds: ['n1', 'n2'],
        density: 0.8,
        modularity: 0.6,
        name: 'Test Cluster',
      };
      const score = scoreClusterAsSkillCandidate(cluster);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should weight density at 0.3, entity count at 0.3, note count at 0.4', () => {
      const cluster: Cluster = {
        id: 'c1',
        entityIds: ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'e10'],
        noteIds: ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10'],
        density: 1.0,
        modularity: 1.0,
        name: 'Max Cluster',
      };
      const score = scoreClusterAsSkillCandidate(cluster);
      // density(1.0)*0.3 + entityCount(10/10)*0.3 + noteCount(10/10)*0.4 = 1.0
      expect(score).toBeCloseTo(1.0);
    });

    it('should give higher score to denser clusters', () => {
      const sparse: Cluster = { id: 'c1', entityIds: ['e1', 'e2'], noteIds: ['n1'], density: 0.2, modularity: 0.5, name: 'Sparse' };
      const dense: Cluster = { id: 'c2', entityIds: ['e1', 'e2'], noteIds: ['n1'], density: 0.9, modularity: 0.5, name: 'Dense' };
      expect(scoreClusterAsSkillCandidate(dense)).toBeGreaterThan(scoreClusterAsSkillCandidate(sparse));
    });

    it('should give higher score to clusters with more notes', () => {
      const fewNotes: Cluster = { id: 'c1', entityIds: ['e1'], noteIds: ['n1'], density: 0.5, modularity: 0.5, name: 'Few' };
      const manyNotes: Cluster = { id: 'c2', entityIds: ['e1'], noteIds: ['n1', 'n2', 'n3', 'n4', 'n5'], density: 0.5, modularity: 0.5, name: 'Many' };
      expect(scoreClusterAsSkillCandidate(manyNotes)).toBeGreaterThan(scoreClusterAsSkillCandidate(fewNotes));
    });

    it('should handle empty cluster gracefully', () => {
      const empty: Cluster = { id: 'c1', entityIds: [], noteIds: [], density: 0, modularity: 0, name: '' };
      const score = scoreClusterAsSkillCandidate(empty);
      expect(score).toBe(0);
    });
  });
});
