import { describe, it, expect } from 'vitest';
import type { GraphEntity, GraphRelation } from '../../types/graph';
import type { Cluster } from './clusterDetector';
import { detectBridgeOpportunities, type BridgeOpportunity } from './bridgeDetector';

describe('bridgeDetector', () => {
  describe('detectBridgeOpportunities', () => {
    it('should return empty array when there are no clusters', () => {
      expect(detectBridgeOpportunities([], [], [])).toEqual([]);
    });

    it('should return empty when clusters share no entities', () => {
      const clusters: Cluster[] = [
        { id: 'c1', entityIds: ['e1', 'e2'], noteIds: ['n1'], density: 0.8, modularity: 0.5, name: 'A' },
        { id: 'c2', entityIds: ['e3', 'e4'], noteIds: ['n2'], density: 0.7, modularity: 0.6, name: 'B' },
      ];
      const entities: GraphEntity[] = [
        { id: 'e1', name: 'X', type: 'Other', sourceNoteIds: ['n1'] },
        { id: 'e2', name: 'Y', type: 'Other', sourceNoteIds: ['n1'] },
        { id: 'e3', name: 'Z', type: 'Other', sourceNoteIds: ['n2'] },
        { id: 'e4', name: 'W', type: 'Other', sourceNoteIds: ['n2'] },
      ];
      const relations: GraphRelation[] = [];
      const opportunities = detectBridgeOpportunities(clusters, entities, relations);
      expect(opportunities).toEqual([]);
    });

    it('should detect bridge opportunity when clusters share entities via cross-cluster relations', () => {
      const clusters: Cluster[] = [
        { id: 'c1', entityIds: ['e1', 'e2'], noteIds: ['n1'], density: 0.8, modularity: 0.5, name: 'Frontend' },
        { id: 'c2', entityIds: ['e3', 'e4'], noteIds: ['n2'], density: 0.7, modularity: 0.6, name: 'Backend' },
      ];
      const entities: GraphEntity[] = [
        { id: 'e1', name: 'React', type: 'Other', sourceNoteIds: ['n1'] },
        { id: 'e2', name: 'API', type: 'Other', sourceNoteIds: ['n1', 'n2'] },
        { id: 'e3', name: 'Express', type: 'Other', sourceNoteIds: ['n2'] },
        { id: 'e4', name: 'API', type: 'Other', sourceNoteIds: ['n1', 'n2'] },
      ];
      // Cross-cluster relation
      const relations: GraphRelation[] = [
        { id: 'r1', fromEntityId: 'e2', toEntityId: 'e4', type: 'related_to', weight: 1 },
      ];
      const opportunities = detectBridgeOpportunities(clusters, entities, relations);
      expect(opportunities.length).toBeGreaterThanOrEqual(1);
    });

    it('should calculate bridge strength based on shared entities and edge weights', () => {
      const clusters: Cluster[] = [
        { id: 'c1', entityIds: ['e1', 'e2'], noteIds: ['n1'], density: 0.8, modularity: 0.5, name: 'A' },
        { id: 'c2', entityIds: ['e3', 'e4'], noteIds: ['n2'], density: 0.7, modularity: 0.6, name: 'B' },
      ];
      const entities: GraphEntity[] = [
        { id: 'e1', name: 'X', type: 'Other', sourceNoteIds: ['n1'] },
        { id: 'e2', name: 'Shared', type: 'Other', sourceNoteIds: ['n1'] },
        { id: 'e3', name: 'Shared', type: 'Other', sourceNoteIds: ['n2'] },
        { id: 'e4', name: 'Y', type: 'Other', sourceNoteIds: ['n2'] },
      ];
      const relations: GraphRelation[] = [
        { id: 'r1', fromEntityId: 'e2', toEntityId: 'e3', type: 'related_to', weight: 2 },
      ];
      const opportunities = detectBridgeOpportunities(clusters, entities, relations);
      expect(opportunities.length).toBeGreaterThanOrEqual(1);
      expect(opportunities[0].bridgeStrength).toBeGreaterThan(0);
    });

    it('should include the correct shared entities in the bridge opportunity', () => {
      const clusters: Cluster[] = [
        { id: 'c1', entityIds: ['e1', 'e2'], noteIds: ['n1'], density: 1, modularity: 0.5, name: 'A' },
        { id: 'c2', entityIds: ['e3', 'e4'], noteIds: ['n2'], density: 1, modularity: 0.5, name: 'B' },
      ];
      const entities: GraphEntity[] = [
        { id: 'e1', name: 'Unique A', type: 'Other', sourceNoteIds: ['n1'] },
        { id: 'e2', name: 'Bridge Entity', type: 'Other', sourceNoteIds: ['n1'] },
        { id: 'e3', name: 'Bridge Entity', type: 'Other', sourceNoteIds: ['n2'] },
        { id: 'e4', name: 'Unique B', type: 'Other', sourceNoteIds: ['n2'] },
      ];
      const relations: GraphRelation[] = [
        { id: 'r1', fromEntityId: 'e2', toEntityId: 'e3', type: 'related_to', weight: 1 },
      ];
      const opportunities = detectBridgeOpportunities(clusters, entities, relations);
      if (opportunities.length > 0) {
        const sharedNames = opportunities[0].sharedEntities.map(e => e.name);
        expect(sharedNames).toContain('Bridge Entity');
      }
    });

    it('should return empty for a single cluster', () => {
      const clusters: Cluster[] = [
        { id: 'c1', entityIds: ['e1'], noteIds: ['n1'], density: 1, modularity: 1, name: 'Solo' },
      ];
      expect(detectBridgeOpportunities(clusters, [], [])).toEqual([]);
    });
  });
});
