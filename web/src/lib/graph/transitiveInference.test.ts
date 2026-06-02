import { describe, it, expect } from 'vitest';
import { findTransitiveCandidates, findTransitiveCandidatesForEntity, detectCycles } from './transitiveInference';
import type { GraphEntity, GraphRelation } from '../../types/graph';

function makeEntity(id: string, name?: string): GraphEntity {
  return { id, name: name ?? id, type: 'Other', sourceNoteIds: ['n1'] };
}

function makeRelation(id: string, from: string, to: string, weight = 0.9): GraphRelation {
  return { id, fromEntityId: from, toEntityId: to, type: 'related_to', weight };
}

describe('transitiveInference', () => {
  describe('findTransitiveCandidates', () => {
    it('finds a 2-hop transitive path', () => {
      const entities = [makeEntity('A'), makeEntity('B'), makeEntity('C')];
      const relations = [
        makeRelation('r1', 'A', 'B', 0.9),
        makeRelation('r2', 'B', 'C', 0.8),
      ];
      const candidates = findTransitiveCandidates(entities, relations);
      const ac = candidates.find(
        (c) => c.fromEntityId === 'A' && c.toEntityId === 'C'
      );
      expect(ac).toBeDefined();
      expect(ac!.hops).toBe(2);
      expect(ac!.path).toEqual(['A', 'B', 'C']);
    });

    it('computes confidence as min(edge weights) * decay^hops', () => {
      const entities = [makeEntity('A'), makeEntity('B'), makeEntity('C')];
      const relations = [
        makeRelation('r1', 'A', 'B', 0.9),
        makeRelation('r2', 'B', 'C', 0.8),
      ];
      const candidates = findTransitiveCandidates(entities, relations, {
        decayFactor: 0.7,
      });
      const ac = candidates.find(
        (c) => c.fromEntityId === 'A' && c.toEntityId === 'C'
      );
      // min(0.9, 0.8) * 0.7^2 = 0.8 * 0.49 = 0.392
      expect(ac!.inferredConfidence).toBeCloseTo(0.392, 3);
    });

    it('respects maxHops option', () => {
      const entities = [makeEntity('A'), makeEntity('B'), makeEntity('C'), makeEntity('D')];
      const relations = [
        makeRelation('r1', 'A', 'B'),
        makeRelation('r2', 'B', 'C'),
        makeRelation('r3', 'C', 'D'),
      ];
      const candidates = findTransitiveCandidates(entities, relations, { maxHops: 2 });
      // A→D would be 3 hops, should not be found
      const ad = candidates.find(
        (c) => c.fromEntityId === 'A' && c.toEntityId === 'D'
      );
      expect(ad).toBeUndefined();
    });

    it('filters out candidates below minConfidence', () => {
      const entities = [makeEntity('A'), makeEntity('B'), makeEntity('C')];
      const relations = [
        makeRelation('r1', 'A', 'B', 0.4),
        makeRelation('r2', 'B', 'C', 0.3),
      ];
      const candidates = findTransitiveCandidates(entities, relations, {
        minConfidence: 0.5,
      });
      expect(candidates).toHaveLength(0);
    });

    it('does not propose relations that already exist', () => {
      const entities = [makeEntity('A'), makeEntity('B'), makeEntity('C')];
      const relations = [
        makeRelation('r1', 'A', 'B'),
        makeRelation('r2', 'B', 'C'),
        makeRelation('r3', 'A', 'C'), // direct relation exists
      ];
      const candidates = findTransitiveCandidates(entities, relations);
      const ac = candidates.find(
        (c) => c.fromEntityId === 'A' && c.toEntityId === 'C'
      );
      expect(ac).toBeUndefined();
    });

    it('returns empty for disconnected entities', () => {
      const entities = [makeEntity('A'), makeEntity('B')];
      const relations: GraphRelation[] = [];
      const candidates = findTransitiveCandidates(entities, relations);
      expect(candidates).toEqual([]);
    });
  });

  describe('findTransitiveCandidatesForEntity', () => {
    it('finds transitive paths from a single entity', () => {
      const entities = [makeEntity('A'), makeEntity('B'), makeEntity('C')];
      const relations = [
        makeRelation('r1', 'A', 'B', 0.9),
        makeRelation('r2', 'B', 'C', 0.8),
      ];
      const candidates = findTransitiveCandidatesForEntity('A', entities, relations);
      expect(candidates.length).toBe(1);
      expect(candidates[0].fromEntityId).toBe('A');
      expect(candidates[0].toEntityId).toBe('C');
      expect(candidates[0].hops).toBe(2);
    });

    it('does not return candidates for non-origin entities', () => {
      const entities = [makeEntity('A'), makeEntity('B'), makeEntity('C'), makeEntity('D')];
      const relations = [
        makeRelation('r1', 'A', 'B', 0.9),
        makeRelation('r2', 'B', 'C', 0.8),
        makeRelation('r3', 'C', 'D', 0.7),
      ];
      const candidates = findTransitiveCandidatesForEntity('A', entities, relations);
      // All candidates should originate from A
      for (const c of candidates) {
        expect(c.fromEntityId).toBe('A');
      }
    });

    it('returns empty for isolated entity', () => {
      const entities = [makeEntity('A'), makeEntity('B')];
      const relations: GraphRelation[] = [];
      const candidates = findTransitiveCandidatesForEntity('A', entities, relations);
      expect(candidates).toEqual([]);
    });

    it('does not propose existing direct relations', () => {
      const entities = [makeEntity('A'), makeEntity('B'), makeEntity('C')];
      const relations = [
        makeRelation('r1', 'A', 'B'),
        makeRelation('r2', 'B', 'C'),
        makeRelation('r3', 'A', 'C'), // direct exists
      ];
      const candidates = findTransitiveCandidatesForEntity('A', entities, relations);
      const ac = candidates.find((c) => c.toEntityId === 'C');
      expect(ac).toBeUndefined();
    });
  });

  describe('detectCycles', () => {
    it('detects a simple cycle', () => {
      const entities = [makeEntity('A'), makeEntity('B'), makeEntity('C')];
      const relations = [
        makeRelation('r1', 'A', 'B'),
        makeRelation('r2', 'B', 'C'),
        makeRelation('r3', 'C', 'A'),
      ];
      const cycles = detectCycles(entities, relations);
      expect(cycles.length).toBeGreaterThan(0);
      // At least one cycle should contain A, B, C
      const hasABC = cycles.some(
        (c) => c.includes('A') && c.includes('B') && c.includes('C')
      );
      expect(hasABC).toBe(true);
    });

    it('returns empty array when no cycles exist', () => {
      const entities = [makeEntity('A'), makeEntity('B'), makeEntity('C')];
      const relations = [
        makeRelation('r1', 'A', 'B'),
        makeRelation('r2', 'B', 'C'),
      ];
      const cycles = detectCycles(entities, relations);
      expect(cycles).toEqual([]);
    });

    it('handles self-loops', () => {
      const entities = [makeEntity('A')];
      const relations = [makeRelation('r1', 'A', 'A')];
      const cycles = detectCycles(entities, relations);
      expect(cycles.length).toBeGreaterThan(0);
    });
  });
});
