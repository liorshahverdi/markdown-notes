import type { GraphEntity, GraphRelation } from '../../types/graph';
import type { Cluster } from './clusterDetector';

export interface BridgeOpportunity {
  clusterA: Cluster;
  clusterB: Cluster;
  sharedEntities: GraphEntity[];
  bridgeStrength: number;
}

/**
 * Detect bridge opportunities between clusters.
 * Bridges are found via:
 * 1. Cross-cluster relations (edges connecting entities in different clusters)
 * 2. Shared entity names across clusters
 */
export function detectBridgeOpportunities(
  clusters: Cluster[],
  entities: GraphEntity[],
  relations: GraphRelation[]
): BridgeOpportunity[] {
  if (clusters.length < 2) return [];

  const entityMap = new Map(entities.map(e => [e.id, e]));
  const opportunities: BridgeOpportunity[] = [];

  // Build cluster membership lookup
  const entityToCluster = new Map<string, string>();
  for (const cluster of clusters) {
    for (const eid of cluster.entityIds) {
      entityToCluster.set(eid, cluster.id);
    }
  }
  const clusterMap = new Map(clusters.map(c => [c.id, c]));

  // For each pair of clusters, find cross-cluster relations and shared entity names
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const cA = clusters[i];
      const cB = clusters[j];
      const setA = new Set(cA.entityIds);
      const setB = new Set(cB.entityIds);

      // Find cross-cluster relations
      const crossRelations = relations.filter(
        r =>
          (setA.has(r.fromEntityId) && setB.has(r.toEntityId)) ||
          (setB.has(r.fromEntityId) && setA.has(r.toEntityId))
      );

      // Find shared entity names
      const namesA = new Set(cA.entityIds.map(id => entityMap.get(id)?.name).filter(Boolean));
      const sharedByName: GraphEntity[] = [];
      for (const eid of cB.entityIds) {
        const entity = entityMap.get(eid);
        if (entity && namesA.has(entity.name)) {
          sharedByName.push(entity);
        }
      }

      // Collect all shared entities (from cross-relations + name matches)
      const sharedEntityIds = new Set<string>();
      for (const r of crossRelations) {
        sharedEntityIds.add(r.fromEntityId);
        sharedEntityIds.add(r.toEntityId);
      }
      for (const e of sharedByName) {
        sharedEntityIds.add(e.id);
      }

      if (sharedEntityIds.size === 0 && crossRelations.length === 0) continue;

      const sharedEntities = Array.from(sharedEntityIds)
        .map(id => entityMap.get(id))
        .filter((e): e is GraphEntity => e !== undefined);

      // Bridge strength = number of shared entities * average edge weight of cross-relations
      const avgWeight =
        crossRelations.length > 0
          ? crossRelations.reduce((sum, r) => sum + (r.weight || 1), 0) / crossRelations.length
          : 1;
      const bridgeStrength = sharedEntities.length * avgWeight;

      if (bridgeStrength > 0) {
        opportunities.push({
          clusterA: cA,
          clusterB: cB,
          sharedEntities,
          bridgeStrength,
        });
      }
    }
  }

  return opportunities;
}
