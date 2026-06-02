/**
 * Graph analytics computation for the analytics dashboard.
 */

import type { GraphEntity, GraphRelation } from '../../types/graph';
import { detectClusters } from '../skills/clusterDetector';

export interface GraphAnalytics {
  totalNodes: number;
  totalEdges: number;
  totalClusters: number;
  avgClusterSize: number;
  entityDistribution: Map<string, number>; // type -> count
  overallModularity: number;
}

export function computeGraphAnalytics(
  entities: GraphEntity[],
  relations: GraphRelation[]
): GraphAnalytics {
  const totalNodes = entities.length;
  const totalEdges = relations.length;

  if (totalNodes === 0) {
    return {
      totalNodes: 0,
      totalEdges: 0,
      totalClusters: 0,
      avgClusterSize: 0,
      entityDistribution: new Map(),
      overallModularity: 0,
    };
  }

  // Entity distribution by type
  const entityDistribution = new Map<string, number>();
  for (const entity of entities) {
    entityDistribution.set(entity.type, (entityDistribution.get(entity.type) ?? 0) + 1);
  }

  // Use detectClusters to get cluster info with modularity
  const clusters = detectClusters(entities, relations);
  const totalClusters = clusters.length;
  const avgClusterSize = totalClusters > 0 ? totalNodes / totalClusters : 0;

  // Overall modularity: average of cluster modularities
  const overallModularity =
    totalClusters > 0
      ? clusters.reduce((sum, c) => sum + c.modularity, 0) / totalClusters
      : 0;

  return {
    totalNodes,
    totalEdges,
    totalClusters,
    avgClusterSize,
    entityDistribution,
    overallModularity,
  };
}
