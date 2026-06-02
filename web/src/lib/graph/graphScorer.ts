/**
 * Graph health scoring and metrics computation.
 */

import type { GraphEntity, GraphRelation } from '../../types/graph';

export interface GraphHealthMetrics {
  totalNodes: number;
  totalEdges: number;
  totalClusters: number;
  avgClusterSize: number;
  connectivity: number;
  orphanCount: number;
  overallScore: number;
}

export function computeGraphHealth(
  entities: GraphEntity[],
  relations: GraphRelation[]
): GraphHealthMetrics {
  const totalNodes = entities.length;
  const totalEdges = relations.length;

  if (totalNodes === 0) {
    return {
      totalNodes: 0,
      totalEdges: 0,
      totalClusters: 0,
      avgClusterSize: 0,
      connectivity: 0,
      orphanCount: 0,
      overallScore: 0,
    };
  }

  // Compute connectivity: edges / (nodes * (nodes - 1) / 2)
  const maxEdges = (totalNodes * (totalNodes - 1)) / 2;
  const connectivity = maxEdges > 0 ? totalEdges / maxEdges : 0;

  // Count relations per entity
  const relationCounts = new Map<string, number>();
  for (const entity of entities) {
    relationCounts.set(entity.id, 0);
  }
  for (const rel of relations) {
    relationCounts.set(
      rel.fromEntityId,
      (relationCounts.get(rel.fromEntityId) ?? 0) + 1
    );
    relationCounts.set(
      rel.toEntityId,
      (relationCounts.get(rel.toEntityId) ?? 0) + 1
    );
  }

  // Orphans: entities with 0 or 1 relation
  const orphanCount = entities.filter(
    (e) => (relationCounts.get(e.id) ?? 0) <= 1
  ).length;

  // Find connected components (clusters) using union-find
  const parent = new Map<string, string>();
  for (const entity of entities) {
    parent.set(entity.id, entity.id);
  }

  function find(id: string): string {
    while (parent.get(id) !== id) {
      parent.set(id, parent.get(parent.get(id)!)!);
      id = parent.get(id)!;
    }
    return id;
  }

  function union(a: string, b: string): void {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent.set(rootA, rootB);
    }
  }

  for (const rel of relations) {
    union(rel.fromEntityId, rel.toEntityId);
  }

  // Count clusters
  const clusterSizes = new Map<string, number>();
  for (const entity of entities) {
    const root = find(entity.id);
    clusterSizes.set(root, (clusterSizes.get(root) ?? 0) + 1);
  }
  const totalClusters = clusterSizes.size;
  const avgClusterSize =
    totalClusters > 0 ? totalNodes / totalClusters : 0;

  // Overall score: weighted combination
  const connectivityScore = Math.min(connectivity * 100, 40);
  const orphanPenalty = totalNodes > 0 ? (orphanCount / totalNodes) * 30 : 0;
  const clusterScore = totalClusters > 0 ? Math.min((avgClusterSize / totalNodes) * 30, 30) : 0;
  const overallScore = Math.max(
    0,
    Math.min(100, Math.round(connectivityScore + clusterScore - orphanPenalty))
  );

  return {
    totalNodes,
    totalEdges,
    totalClusters,
    avgClusterSize,
    connectivity,
    orphanCount,
    overallScore,
  };
}

export function findOrphans(
  entities: GraphEntity[],
  relations: GraphRelation[]
): GraphEntity[] {
  const relationCounts = new Map<string, number>();
  for (const entity of entities) {
    relationCounts.set(entity.id, 0);
  }
  for (const rel of relations) {
    relationCounts.set(
      rel.fromEntityId,
      (relationCounts.get(rel.fromEntityId) ?? 0) + 1
    );
    relationCounts.set(
      rel.toEntityId,
      (relationCounts.get(rel.toEntityId) ?? 0) + 1
    );
  }

  return entities.filter((e) => (relationCounts.get(e.id) ?? 0) <= 1);
}
