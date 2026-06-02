import { describe, it, expect } from 'vitest';
import type { SkillRecord } from './skillTemplate';
import {
  buildDependencyDAG,
  getTransitiveDependencies,
  detectCycles,
  type SkillDependencyNode,
  type SkillDependencyEdge,
} from './skillDependencyGraph';

function makeSkill(id: string, name: string, requires: string[] = [], enhances: string[] = []): SkillRecord {
  return {
    id,
    name,
    domain: 'Test',
    type: 'single',
    content: `# ${name}`,
    sourceNoteIds: [],
    parentSkillIds: [],
    dependencies: { requires, enhances },
    confidence: 'high',
    versions: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe('skillDependencyGraph', () => {
  describe('buildDependencyDAG', () => {
    it('should return empty graph for empty input', () => {
      const { nodes, edges } = buildDependencyDAG([]);
      expect(nodes).toEqual([]);
      expect(edges).toEqual([]);
    });

    it('should create a node for each skill', () => {
      const skills = [makeSkill('s1', 'Skill A'), makeSkill('s2', 'Skill B')];
      const { nodes } = buildDependencyDAG(skills);
      expect(nodes).toHaveLength(2);
      expect(nodes.map(n => n.skillId)).toContain('s1');
      expect(nodes.map(n => n.skillId)).toContain('s2');
    });

    it('should create edges for requires dependencies', () => {
      const skills = [
        makeSkill('s1', 'Skill A'),
        makeSkill('s2', 'Skill B', ['s1']),
      ];
      const { edges } = buildDependencyDAG(skills);
      expect(edges).toHaveLength(1);
      expect(edges[0]).toEqual({ from: 's2', to: 's1', type: 'requires' });
    });

    it('should create edges for enhances dependencies', () => {
      const skills = [
        makeSkill('s1', 'Skill A', [], ['s2']),
        makeSkill('s2', 'Skill B'),
      ];
      const { edges } = buildDependencyDAG(skills);
      expect(edges).toHaveLength(1);
      expect(edges[0]).toEqual({ from: 's1', to: 's2', type: 'enhances' });
    });

    it('should include skill name and type in nodes', () => {
      const skills = [makeSkill('s1', 'My Skill')];
      const { nodes } = buildDependencyDAG(skills);
      expect(nodes[0].name).toBe('My Skill');
      expect(nodes[0].type).toBe('single');
    });

    it('should handle skills with both requires and enhances', () => {
      const skills = [
        makeSkill('s1', 'A'),
        makeSkill('s2', 'B'),
        makeSkill('s3', 'C', ['s1'], ['s2']),
      ];
      const { edges } = buildDependencyDAG(skills);
      expect(edges).toHaveLength(2);
    });
  });

  describe('getTransitiveDependencies', () => {
    it('should return empty array for skill with no dependencies', () => {
      const skills = [makeSkill('s1', 'A')];
      expect(getTransitiveDependencies('s1', skills)).toEqual([]);
    });

    it('should return direct dependencies', () => {
      const skills = [
        makeSkill('s1', 'A'),
        makeSkill('s2', 'B', ['s1']),
      ];
      const deps = getTransitiveDependencies('s2', skills);
      expect(deps).toContain('s1');
    });

    it('should return transitive dependencies (BFS)', () => {
      const skills = [
        makeSkill('s1', 'A'),
        makeSkill('s2', 'B', ['s1']),
        makeSkill('s3', 'C', ['s2']),
      ];
      const deps = getTransitiveDependencies('s3', skills);
      expect(deps).toContain('s2');
      expect(deps).toContain('s1');
    });

    it('should not include the skill itself', () => {
      const skills = [
        makeSkill('s1', 'A'),
        makeSkill('s2', 'B', ['s1']),
      ];
      const deps = getTransitiveDependencies('s2', skills);
      expect(deps).not.toContain('s2');
    });

    it('should handle diamond dependencies without duplicates', () => {
      const skills = [
        makeSkill('s1', 'A'),
        makeSkill('s2', 'B', ['s1']),
        makeSkill('s3', 'C', ['s1']),
        makeSkill('s4', 'D', ['s2', 's3']),
      ];
      const deps = getTransitiveDependencies('s4', skills);
      expect(deps).toContain('s1');
      expect(deps).toContain('s2');
      expect(deps).toContain('s3');
      // No duplicates
      expect(new Set(deps).size).toBe(deps.length);
    });

    it('should return empty for unknown skill ID', () => {
      const skills = [makeSkill('s1', 'A')];
      expect(getTransitiveDependencies('unknown', skills)).toEqual([]);
    });
  });

  describe('detectCycles', () => {
    it('should return empty array for acyclic graph', () => {
      const skills = [
        makeSkill('s1', 'A'),
        makeSkill('s2', 'B', ['s1']),
        makeSkill('s3', 'C', ['s2']),
      ];
      expect(detectCycles(skills)).toEqual([]);
    });

    it('should detect a simple 2-node cycle', () => {
      const skills = [
        makeSkill('s1', 'A', ['s2']),
        makeSkill('s2', 'B', ['s1']),
      ];
      const cycles = detectCycles(skills);
      expect(cycles.length).toBeGreaterThan(0);
      // The cycle should contain both s1 and s2
      const flat = cycles.flat();
      expect(flat).toContain('s1');
      expect(flat).toContain('s2');
    });

    it('should detect a 3-node cycle', () => {
      const skills = [
        makeSkill('s1', 'A', ['s3']),
        makeSkill('s2', 'B', ['s1']),
        makeSkill('s3', 'C', ['s2']),
      ];
      const cycles = detectCycles(skills);
      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should return empty for no skills', () => {
      expect(detectCycles([])).toEqual([]);
    });

    it('should not report false cycles in a DAG', () => {
      // Diamond shape - no cycle
      const skills = [
        makeSkill('s1', 'A'),
        makeSkill('s2', 'B', ['s1']),
        makeSkill('s3', 'C', ['s1']),
        makeSkill('s4', 'D', ['s2', 's3']),
      ];
      expect(detectCycles(skills)).toEqual([]);
    });
  });
});
