/**
 * Cluster quality metrics computation.
 */

import type { GraphEntity, GraphRelation } from '../../types/graph';
import type { Cluster } from '../skills/clusterDetector';

export interface ClusterQuality {
  clusterId: string;
  clusterName: string;
  modularity: number;
  internalDensity: number;
  entityCount: number;
  noteCount: number;
  coverage: number; // percentage of source notes' content represented
}

export function computeClusterQualities(
  clusters: Cluster[],
  entities: GraphEntity[],
  relations: GraphRelation[]
): ClusterQuality[] {
  if (clusters.length === 0) return [];

  const entityMap = new Map(entities.map((e) => [e.id, e]));

  return clusters.map((cluster) => {
    const memberSet = new Set(cluster.entityIds);
    const entityCount = cluster.entityIds.length;
    const noteCount = cluster.noteIds.length;

    // Compute internal density: internal edges / possible edges
    const internalEdges = relations.filter(
      (r) => memberSet.has(r.fromEntityId) && memberSet.has(r.toEntityId)
    ).length;
    const possibleEdges = (entityCount * (entityCount - 1)) / 2;
    const internalDensity = possibleEdges > 0 ? internalEdges / possibleEdges : 0;

    // Compute coverage: cluster noteIds / unique source notes from entities in cluster
    const allSourceNoteIds = new Set<string>();
    for (const eid of cluster.entityIds) {
      const entity = entityMap.get(eid);
      if (entity) {
        for (const nid of entity.sourceNoteIds) {
          allSourceNoteIds.add(nid);
        }
      }
    }
    const coverage =
      allSourceNoteIds.size > 0 ? noteCount / allSourceNoteIds.size : 0;

    return {
      clusterId: cluster.id,
      clusterName: cluster.name,
      modularity: cluster.modularity,
      internalDensity,
      entityCount,
      noteCount,
      coverage,
    };
  });
}
