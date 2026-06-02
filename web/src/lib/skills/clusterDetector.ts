import type { GraphEntity, GraphRelation } from '../../types/graph';

export interface Cluster {
  id: string;
  entityIds: string[];
  noteIds: string[];
  density: number;
  modularity: number;
  name: string;
}

/**
 * Find connected components using Union-Find, then compute density and modularity.
 */
export function detectClusters(
  entities: GraphEntity[],
  relations: GraphRelation[]
): Cluster[] {
  if (entities.length === 0) return [];

  // Build adjacency using Union-Find
  const parent = new Map<string, string>();
  const rank = new Map<string, number>();

  for (const e of entities) {
    parent.set(e.id, e.id);
    rank.set(e.id, 0);
  }

  function find(x: string): string {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!); // path compression
      x = parent.get(x)!;
    }
    return x;
  }

  function union(a: string, b: string): void {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    const rankA = rank.get(ra)!;
    const rankB = rank.get(rb)!;
    if (rankA < rankB) {
      parent.set(ra, rb);
    } else if (rankA > rankB) {
      parent.set(rb, ra);
    } else {
      parent.set(rb, ra);
      rank.set(ra, rankA + 1);
    }
  }

  const entityIdSet = new Set(entities.map(e => e.id));

  // Only consider relations where both endpoints are in our entity set
  const validRelations = relations.filter(
    r => entityIdSet.has(r.fromEntityId) && entityIdSet.has(r.toEntityId)
  );

  for (const r of validRelations) {
    union(r.fromEntityId, r.toEntityId);
  }

  // Group entities by component root
  const components = new Map<string, string[]>();
  for (const e of entities) {
    const root = find(e.id);
    if (!components.has(root)) components.set(root, []);
    components.get(root)!.push(e.id);
  }

  const entityMap = new Map(entities.map(e => [e.id, e]));
  const totalEdges = validRelations.length;

  const clusters: Cluster[] = [];
  let idx = 0;

  for (const [, memberIds] of components) {
    const memberSet = new Set(memberIds);

    // Count internal edges
    const internalEdges = validRelations.filter(
      r => memberSet.has(r.fromEntityId) && memberSet.has(r.toEntityId)
    ).length;

    const n = memberIds.length;
    const possibleEdges = n * (n - 1) / 2;
    const density = possibleEdges > 0 ? internalEdges / possibleEdges : 0;

    // Collect noteIds
    const noteIdSet = new Set<string>();
    for (const eid of memberIds) {
      const entity = entityMap.get(eid);
      if (entity) {
        for (const nid of entity.sourceNoteIds) {
          noteIdSet.add(nid);
        }
      }
    }

    // Modularity: fraction of edges that are internal vs total
    // If no edges in graph, modularity = 1 for isolated components, 0 for single nodes with no edges
    let modularity: number;
    if (totalEdges === 0) {
      modularity = n > 1 ? 1 : 0;
    } else {
      const externalEdges = validRelations.filter(
        r =>
          (memberSet.has(r.fromEntityId) && !memberSet.has(r.toEntityId)) ||
          (!memberSet.has(r.fromEntityId) && memberSet.has(r.toEntityId))
      ).length;
      modularity = externalEdges === 0 ? 1 : internalEdges / (internalEdges + externalEdges);
    }

    // Name: top entities by connection count
    const connectionCount = new Map<string, number>();
    for (const eid of memberIds) {
      connectionCount.set(eid, 0);
    }
    for (const r of validRelations) {
      if (memberSet.has(r.fromEntityId)) {
        connectionCount.set(r.fromEntityId, (connectionCount.get(r.fromEntityId) || 0) + 1);
      }
      if (memberSet.has(r.toEntityId)) {
        connectionCount.set(r.toEntityId, (connectionCount.get(r.toEntityId) || 0) + 1);
      }
    }

    const sortedByConnections = memberIds
      .sort((a, b) => (connectionCount.get(b) || 0) - (connectionCount.get(a) || 0));
    const topNames = sortedByConnections
      .slice(0, 3)
      .map(id => entityMap.get(id)?.name || id);
    const name = topNames.join(', ');

    clusters.push({
      id: `cluster-${idx++}`,
      entityIds: memberIds,
      noteIds: Array.from(noteIdSet),
      density,
      modularity,
      name,
    });
  }

  return clusters;
}

/**
 * Composite score: density * 0.3 + entityCount * 0.3 + noteCount * 0.4 (normalized)
 * Entity/note counts normalized to max 10.
 */
export function scoreClusterAsSkillCandidate(cluster: Cluster): number {
  const MAX_ENTITIES = 10;
  const MAX_NOTES = 10;

  const densityScore = cluster.density;
  const entityScore = Math.min(cluster.entityIds.length / MAX_ENTITIES, 1);
  const noteScore = Math.min(cluster.noteIds.length / MAX_NOTES, 1);

  return densityScore * 0.3 + entityScore * 0.3 + noteScore * 0.4;
}
