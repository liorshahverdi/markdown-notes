import { describe, it, expect } from 'vitest';
import type { GraphEntity, GraphRelation } from '../../types/graph';
import type { Cluster } from './clusterDetector';
import { buildSkillPrompt } from './skillGenerator';

describe('skillGenerator', () => {
  const cluster: Cluster = {
    id: 'c1',
    entityIds: ['e1', 'e2'],
    noteIds: ['n1', 'n2'],
    density: 0.8,
    modularity: 0.6,
    name: 'TypeScript Patterns',
  };

  const notes = [
    { title: 'TypeScript Basics', content: 'TypeScript is a typed superset of JavaScript.' },
    { title: 'Design Patterns', content: 'Common patterns include Factory, Observer, etc.' },
  ];

  const entities: GraphEntity[] = [
    { id: 'e1', name: 'TypeScript', type: 'Other', sourceNoteIds: ['n1'] },
    { id: 'e2', name: 'Design Patterns', type: 'Other', sourceNoteIds: ['n2'] },
  ];

  const relations: GraphRelation[] = [
    { id: 'r1', fromEntityId: 'e1', toEntityId: 'e2', type: 'related_to', weight: 1 },
  ];

  describe('buildSkillPrompt', () => {
    it('should return a non-empty string', () => {
      const prompt = buildSkillPrompt(cluster, notes, entities, relations);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should include the cluster name in the prompt', () => {
      const prompt = buildSkillPrompt(cluster, notes, entities, relations);
      expect(prompt).toContain('TypeScript Patterns');
    });

    it('should include note titles and content', () => {
      const prompt = buildSkillPrompt(cluster, notes, entities, relations);
      expect(prompt).toContain('TypeScript Basics');
      expect(prompt).toContain('typed superset');
      expect(prompt).toContain('Design Patterns');
    });

    it('should include entity names', () => {
      const prompt = buildSkillPrompt(cluster, notes, entities, relations);
      expect(prompt).toContain('TypeScript');
      expect(prompt).toContain('Design Patterns');
    });

    it('should include instructions for skill format output', () => {
      const prompt = buildSkillPrompt(cluster, notes, entities, relations);
      // Should tell the LLM to produce skill markdown format
      expect(prompt).toContain('Description');
      expect(prompt).toContain('Instructions');
    });

    it('should request evidence citations in the prompt', () => {
      const prompt = buildSkillPrompt(cluster, notes, entities, relations);
      expect(prompt.toLowerCase()).toContain('citation');
    });
  });
});
