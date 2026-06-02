import type { SkillRecord } from './skillTemplate';

export interface SkillDependencyNode {
  skillId: string;
  name: string;
  type: SkillRecord['type'];
}

export interface SkillDependencyEdge {
  from: string;
  to: string;
  type: 'requires' | 'enhances';
}

export function buildDependencyDAG(skills: SkillRecord[]): {
  nodes: SkillDependencyNode[];
  edges: SkillDependencyEdge[];
} {
  const nodes: SkillDependencyNode[] = skills.map(s => ({
    skillId: s.id,
    name: s.name,
    type: s.type,
  }));

  const edges: SkillDependencyEdge[] = [];
  const skillIds = new Set(skills.map(s => s.id));

  for (const skill of skills) {
    for (const reqId of skill.dependencies.requires) {
      if (skillIds.has(reqId)) {
        edges.push({ from: skill.id, to: reqId, type: 'requires' });
      }
    }
    for (const enhId of skill.dependencies.enhances) {
      if (skillIds.has(enhId)) {
        edges.push({ from: skill.id, to: enhId, type: 'enhances' });
      }
    }
  }

  return { nodes, edges };
}

/**
 * BFS to find all transitive dependencies (requires) of a skill.
 */
export function getTransitiveDependencies(skillId: string, skills: SkillRecord[]): string[] {
  const skillMap = new Map(skills.map(s => [s.id, s]));
  const skill = skillMap.get(skillId);
  if (!skill) return [];

  const visited = new Set<string>();
  const queue = [...skill.dependencies.requires];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const dep = skillMap.get(current);
    if (dep) {
      for (const reqId of dep.dependencies.requires) {
        if (!visited.has(reqId)) {
          queue.push(reqId);
        }
      }
    }
  }

  return Array.from(visited);
}

/**
 * Detect cycles using DFS with coloring (white/gray/black).
 * Returns arrays of skill IDs forming cycles.
 */
export function detectCycles(skills: SkillRecord[]): string[][] {
  if (skills.length === 0) return [];

  const skillMap = new Map(skills.map(s => [s.id, s]));
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const cycles: string[][] = [];

  for (const s of skills) {
    color.set(s.id, WHITE);
  }

  function dfs(nodeId: string, path: string[]): void {
    color.set(nodeId, GRAY);
    path.push(nodeId);

    const skill = skillMap.get(nodeId);
    if (skill) {
      for (const neighbor of skill.dependencies.requires) {
        if (!skillMap.has(neighbor)) continue;

        if (color.get(neighbor) === GRAY) {
          // Found a cycle - extract it from path
          const cycleStart = path.indexOf(neighbor);
          if (cycleStart >= 0) {
            cycles.push(path.slice(cycleStart));
          }
        } else if (color.get(neighbor) === WHITE) {
          dfs(neighbor, path);
        }
      }
    }

    path.pop();
    color.set(nodeId, BLACK);
  }

  for (const s of skills) {
    if (color.get(s.id) === WHITE) {
      dfs(s.id, []);
    }
  }

  return cycles;
}
