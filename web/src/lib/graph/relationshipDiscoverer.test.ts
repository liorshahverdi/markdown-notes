import { describe, it, expect } from 'vitest';
import { findRelationshipCandidates, buildRelationshipPrompt } from './relationshipDiscoverer';
import type { GraphEntity, GraphRelation } from '../../types/graph';

function makeEntity(id: string, name: string, noteIds: string[]): GraphEntity {
  return { id, name, type: 'Other', sourceNoteIds: noteIds };
}

describe('relationshipDiscoverer', () => {
  describe('findRelationshipCandidates', () => {
    it('finds entity pairs sharing 2+ notes but without direct relation', () => {
      const entities = [
        makeEntity('e1', 'React', ['n1', 'n2']),
        makeEntity('e2', 'TypeScript', ['n1', 'n2']),
        makeEntity('e3', 'Python', ['n4']),
      ];
      const relations: GraphRelation[] = [];
      const candidates = findRelationshipCandidates(entities, relations);
      const reactTs = candidates.find(
        (c) =>
          (c.entityA.id === 'e1' && c.entityB.id === 'e2') ||
          (c.entityA.id === 'e2' && c.entityB.id === 'e1')
      );
      expect(reactTs).toBeDefined();
      expect(reactTs!.sharedNoteIds).toContain('n1');
    });

    it('does not find pairs sharing only 1 note', () => {
      const entities = [
        makeEntity('e1', 'React', ['n1', 'n2']),
        makeEntity('e2', 'TypeScript', ['n1', 'n3']),
      ];
      const candidates = findRelationshipCandidates(entities, []);
      expect(candidates).toHaveLength(0);
    });

    it('caps candidates at MAX_CANDIDATES', () => {
      // Create many entities that all share 2 notes
      const entities = Array.from({ length: 50 }, (_, i) =>
        makeEntity(`e${i}`, `Entity${i}`, ['n1', 'n2'])
      );
      const candidates = findRelationshipCandidates(entities, []);
      expect(candidates.length).toBeLessThanOrEqual(100);
    });

    it('excludes pairs that already have a direct relation', () => {
      const entities = [
        makeEntity('e1', 'React', ['n1', 'n2']),
        makeEntity('e2', 'TypeScript', ['n1', 'n2']),
      ];
      const relations: GraphRelation[] = [
        { id: 'r1', fromEntityId: 'e1', toEntityId: 'e2', type: 'related_to' },
      ];
      const candidates = findRelationshipCandidates(entities, relations);
      expect(candidates).toHaveLength(0);
    });

    it('returns empty when no entities share notes', () => {
      const entities = [
        makeEntity('e1', 'A', ['n1']),
        makeEntity('e2', 'B', ['n2']),
      ];
      const candidates = findRelationshipCandidates(entities, []);
      expect(candidates).toHaveLength(0);
    });

    it('finds multiple shared note IDs', () => {
      const entities = [
        makeEntity('e1', 'ML', ['n1', 'n2', 'n3']),
        makeEntity('e2', 'AI', ['n1', 'n2']),
      ];
      const candidates = findRelationshipCandidates(entities, []);
      expect(candidates[0].sharedNoteIds).toHaveLength(2);
    });
  });

  describe('buildRelationshipPrompt', () => {
    it('includes both entity names', () => {
      const entityA = makeEntity('e1', 'React', ['n1']);
      const entityB = makeEntity('e2', 'TypeScript', ['n1']);
      const notes = [{ title: 'Note 1', content: 'React and TypeScript work well together' }];
      const prompt = buildRelationshipPrompt(entityA, entityB, notes);
      expect(prompt).toContain('React');
      expect(prompt).toContain('TypeScript');
    });

    it('includes note content', () => {
      const entityA = makeEntity('e1', 'A', ['n1']);
      const entityB = makeEntity('e2', 'B', ['n1']);
      const notes = [{ title: 'Test Note', content: 'Some relevant content about A and B' }];
      const prompt = buildRelationshipPrompt(entityA, entityB, notes);
      expect(prompt).toContain('Some relevant content');
    });

    it('returns a non-empty string', () => {
      const entityA = makeEntity('e1', 'X', []);
      const entityB = makeEntity('e2', 'Y', []);
      const prompt = buildRelationshipPrompt(entityA, entityB, []);
      expect(prompt.length).toBeGreaterThan(0);
    });
  });
});
