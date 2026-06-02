import { describe, it, expect } from 'vitest';
import type { SkillRecord } from './skillTemplate';
import type { Cluster } from './clusterDetector';
import type { GraphEntity } from '../../types/graph';
import { buildMergePrompt, buildChainPrompt, buildBridgePrompt } from './skillCombiner';

const skillA: SkillRecord = {
  id: 's1',
  name: 'TypeScript Skill',
  domain: 'Programming',
  type: 'single',
  content: '# TypeScript Skill\n\n## Description\nTypeScript development practices.',
  sourceNoteIds: ['n1'],
  parentSkillIds: [],
  dependencies: { requires: [], enhances: [] },
  confidence: 'high',
  versions: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const skillB: SkillRecord = {
  id: 's2',
  name: 'Testing Skill',
  domain: 'Quality',
  type: 'single',
  content: '# Testing Skill\n\n## Description\nTesting best practices.',
  sourceNoteIds: ['n2'],
  parentSkillIds: [],
  dependencies: { requires: [], enhances: [] },
  confidence: 'medium',
  versions: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe('skillCombiner', () => {
  describe('buildMergePrompt', () => {
    it('should return a non-empty prompt string', () => {
      const prompt = buildMergePrompt([skillA, skillB]);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should include all skill names', () => {
      const prompt = buildMergePrompt([skillA, skillB]);
      expect(prompt).toContain('TypeScript Skill');
      expect(prompt).toContain('Testing Skill');
    });

    it('should include skill content', () => {
      const prompt = buildMergePrompt([skillA, skillB]);
      expect(prompt).toContain('TypeScript development practices');
      expect(prompt).toContain('Testing best practices');
    });

    it('should instruct to merge into a single skill', () => {
      const prompt = buildMergePrompt([skillA, skillB]);
      expect(prompt.toLowerCase()).toContain('merge');
    });
  });

  describe('buildChainPrompt', () => {
    it('should return a non-empty prompt string', () => {
      const prompt = buildChainPrompt(skillA, skillB);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should reference both skills', () => {
      const prompt = buildChainPrompt(skillA, skillB);
      expect(prompt).toContain('TypeScript Skill');
      expect(prompt).toContain('Testing Skill');
    });

    it('should indicate dependency relationship', () => {
      const prompt = buildChainPrompt(skillA, skillB);
      expect(prompt.toLowerCase()).toMatch(/depend|require|build.*on|chain/);
    });
  });

  describe('buildBridgePrompt', () => {
    const clusterA: Cluster = {
      id: 'ca',
      entityIds: ['e1', 'e2'],
      noteIds: ['n1'],
      density: 0.8,
      modularity: 0.5,
      name: 'Frontend Cluster',
    };
    const clusterB: Cluster = {
      id: 'cb',
      entityIds: ['e3', 'e4'],
      noteIds: ['n2'],
      density: 0.7,
      modularity: 0.6,
      name: 'Backend Cluster',
    };
    const sharedEntities: GraphEntity[] = [
      { id: 'e5', name: 'API', type: 'Other', sourceNoteIds: ['n1', 'n2'] },
    ];
    const notes = [
      { title: 'Frontend Guide', content: 'Frontend development with APIs.' },
      { title: 'Backend Guide', content: 'Backend serves APIs.' },
    ];

    it('should return a non-empty prompt string', () => {
      const prompt = buildBridgePrompt(clusterA, clusterB, sharedEntities, notes);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should reference both cluster names', () => {
      const prompt = buildBridgePrompt(clusterA, clusterB, sharedEntities, notes);
      expect(prompt).toContain('Frontend Cluster');
      expect(prompt).toContain('Backend Cluster');
    });

    it('should mention shared entities', () => {
      const prompt = buildBridgePrompt(clusterA, clusterB, sharedEntities, notes);
      expect(prompt).toContain('API');
    });

    it('should include note content', () => {
      const prompt = buildBridgePrompt(clusterA, clusterB, sharedEntities, notes);
      expect(prompt).toContain('Frontend development with APIs');
    });

    it('should instruct to create a bridge skill', () => {
      const prompt = buildBridgePrompt(clusterA, clusterB, sharedEntities, notes);
      expect(prompt.toLowerCase()).toContain('bridge');
    });
  });
});
