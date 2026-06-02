/**
 * Transitive inference and cycle detection for the knowledge graph.
 */

import type { GraphEntity, GraphRelation } from '../../types/graph';

export interface TransitiveCandidate {
  fromEntityId: string;
  toEntityId: string;
  path: string[];
  hops: number;
  inferredConfidence: number;
}

interface BFSState {
  entityId: string;
  path: string[];
  minWeight: number;
}

/**
 * Single-origin BFS: finds transitive candidates from one entity only.
 * Used for lazy, on-demand expansion when a user clicks a node.
 */
export function findTransitiveCandidatesForEntity(
  entityId: string,
  entities: GraphEntity[],
  relations: GraphRelation[],
  options?: { maxHops?: number; decayFactor?: number; minConfidence?: number }
): TransitiveCandidate[] {
  const maxHops = options?.maxHops ?? 3;
  const decayFactor = options?.decayFactor ?? 0.7;
  const minConfidence = options?.minConfidence ?? 0.3;

  // Build adjacency list
  const adjacency = new Map<string, Array<{ target: string; weight: number }>>();
  for (const entity of entities) {
    adjacency.set(entity.id, []);
  }
  for (const rel of relations) {
    adjacency.get(rel.fromEntityId)?.push({
      target: rel.toEntityId,
      weight: rel.weight ?? 1,
    });
    adjacency.get(rel.toEntityId)?.push({
      target: rel.fromEntityId,
      weight: rel.weight ?? 1,
    });
  }

  // Build set of existing direct relations
  const existingRelations = new Set<string>();
  for (const rel of relations) {
    existingRelations.add(`${rel.fromEntityId}->${rel.toEntityId}`);
    existingRelations.add(`${rel.toEntityId}->${rel.fromEntityId}`);
  }

  const candidates: TransitiveCandidate[] = [];

  // BFS from the single entity
  const queue: BFSState[] = [
    { entityId, path: [entityId], minWeight: Infinity },
  ];
  const visited = new Set<string>([entityId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const hops = current.path.length - 1;

    if (hops >= maxHops) continue;

    const neighbors = adjacency.get(current.entityId) ?? [];
    for (const neighbor of neighbors) {
      if (visited.has(neighbor.target)) continue;

      const newMinWeight = Math.min(current.minWeight, neighbor.weight);
      const newPath = [...current.path, neighbor.target];
      const newHops = newPath.length - 1;

      visited.add(neighbor.target);

      if (newHops >= 2) {
        if (!existingRelations.has(`${entityId}->${neighbor.target}`)) {
          const confidence = newMinWeight * Math.pow(decayFactor, newHops);
          if (confidence >= minConfidence) {
            candidates.push({
              fromEntityId: entityId,
              toEntityId: neighbor.target,
              path: newPath,
              hops: newHops,
              inferredConfidence: confidence,
            });
          }
        }
      }

      queue.push({
        entityId: neighbor.target,
        path: newPath,
        minWeight: newMinWeight,
      });
    }
  }

  return candidates;
}

export function findTransitiveCandidates(
  entities: GraphEntity[],
  relations: GraphRelation[],
  options?: { maxHops?: number; decayFactor?: number; minConfidence?: number }
): TransitiveCandidate[] {
  const maxHops = options?.maxHops ?? 3;
  const decayFactor = options?.decayFactor ?? 0.7;
  const minConfidence = options?.minConfidence ?? 0.3;

  // Build adjacency list (undirected for traversal)
  const adjacency = new Map<string, Array<{ target: string; weight: number }>>();
  for (const entity of entities) {
    adjacency.set(entity.id, []);
  }
  for (const rel of relations) {
    adjacency.get(rel.fromEntityId)?.push({
      target: rel.toEntityId,
      weight: rel.weight ?? 1,
    });
    adjacency.get(rel.toEntityId)?.push({
      target: rel.fromEntityId,
      weight: rel.weight ?? 1,
    });
  }

  // Build set of existing direct relations (both directions)
  const existingRelations = new Set<string>();
  for (const rel of relations) {
    existingRelations.add(`${rel.fromEntityId}->${rel.toEntityId}`);
    existingRelations.add(`${rel.toEntityId}->${rel.fromEntityId}`);
  }

  const candidates: TransitiveCandidate[] = [];
  const seen = new Set<string>(); // avoid duplicate A-C and C-A

  for (const entity of entities) {
    // BFS from this entity
    const queue: BFSState[] = [
      { entityId: entity.id, path: [entity.id], minWeight: Infinity },
    ];
    const visited = new Set<string>([entity.id]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const hops = current.path.length - 1;

      if (hops >= maxHops) continue;

      const neighbors = adjacency.get(current.entityId) ?? [];
      for (const neighbor of neighbors) {
        if (visited.has(neighbor.target)) continue;

        const newMinWeight = Math.min(current.minWeight, neighbor.weight);
        const newPath = [...current.path, neighbor.target];
        const newHops = newPath.length - 1;

        visited.add(neighbor.target);

        // Only consider multi-hop paths (2+ hops) as transitive candidates
        if (newHops >= 2) {
          const pairKey = [entity.id, neighbor.target].sort().join('::');
          if (
            !existingRelations.has(`${entity.id}->${neighbor.target}`) &&
            !seen.has(pairKey)
          ) {
            const confidence = newMinWeight * Math.pow(decayFactor, newHops);
            if (confidence >= minConfidence) {
              candidates.push({
                fromEntityId: entity.id,
                toEntityId: neighbor.target,
                path: newPath,
                hops: newHops,
                inferredConfidence: confidence,
              });
              seen.add(pairKey);
            }
          }
        }

        queue.push({
          entityId: neighbor.target,
          path: newPath,
          minWeight: newMinWeight,
        });
      }
    }
  }

  return candidates;
}

export function detectCycles(
  entities: GraphEntity[],
  relations: GraphRelation[]
): string[][] {
  // Build directed adjacency list
  const adjacency = new Map<string, string[]>();
  for (const entity of entities) {
    adjacency.set(entity.id, []);
  }
  for (const rel of relations) {
    adjacency.get(rel.fromEntityId)?.push(rel.toEntityId);
  }

  const cycles: string[][] = [];
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();

  for (const entity of entities) {
    color.set(entity.id, WHITE);
  }

  function dfs(node: string, path: string[]): void {
    color.set(node, GRAY);

    const neighbors = adjacency.get(node) ?? [];
    for (const next of neighbors) {
      if (color.get(next) === GRAY) {
        // Found a cycle - extract it
        const cycleStart = path.indexOf(next);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart).concat(next));
        } else {
          // Self-loop
          cycles.push([next, next]);
        }
      } else if (color.get(next) === WHITE) {
        parent.set(next, node);
        dfs(next, [...path, next]);
      }
    }

    color.set(node, BLACK);
  }

  for (const entity of entities) {
    if (color.get(entity.id) === WHITE) {
      dfs(entity.id, [entity.id]);
    }
  }

  return cycles;
}
