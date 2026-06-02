import { describe, it, expect } from 'vitest';
import { findDuplicateCandidates, buildDeduplicationPrompt, mergeEntities } from './entityDeduplicator';
import type { GraphEntity, GraphRelation } from '../../types/graph';

function makeEntity(id: string, name: string, noteIds: string[] = ['n1']): GraphEntity {
  return { id, name, type: 'Other', sourceNoteIds: noteIds };
}

describe('entityDeduplicator', () => {
  describe('findDuplicateCandidates', () => {
    it('finds case-insensitive matches', () => {
      const entities = [makeEntity('e1', 'React'), makeEntity('e2', 'react')];
      const candidates = findDuplicateCandidates(entities);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].similarity).toBeGreaterThan(0);
    });

    it('finds substring matches', () => {
      const entities = [makeEntity('e1', 'React'), makeEntity('e2', 'ReactJS')];
      const candidates = findDuplicateCandidates(entities);
      expect(candidates).toHaveLength(1);
    });

    it('finds abbreviation patterns like X vs X.js', () => {
      const entities = [makeEntity('e1', 'React'), makeEntity('e2', 'React.js')];
      const candidates = findDuplicateCandidates(entities);
      expect(candidates).toHaveLength(1);
    });

    it('does not flag completely different entities', () => {
      const entities = [makeEntity('e1', 'React'), makeEntity('e2', 'Python')];
      const candidates = findDuplicateCandidates(entities);
      expect(candidates).toHaveLength(0);
    });

    it('returns a reason for each candidate', () => {
      const entities = [makeEntity('e1', 'React'), makeEntity('e2', 'react')];
      const candidates = findDuplicateCandidates(entities);
      expect(candidates[0].reason).toBeTruthy();
    });

    it('handles single entity', () => {
      const entities = [makeEntity('e1', 'React')];
      const candidates = findDuplicateCandidates(entities);
      expect(candidates).toHaveLength(0);
    });
  });

  describe('buildDeduplicationPrompt', () => {
    it('includes both entity names and reason', () => {
      const candidate = {
        entityA: makeEntity('e1', 'React'),
        entityB: makeEntity('e2', 'ReactJS'),
        similarity: 0.9,
        reason: 'substring match',
      };
      const prompt = buildDeduplicationPrompt(candidate);
      expect(prompt).toContain('React');
      expect(prompt).toContain('ReactJS');
      expect(prompt).toContain('substring');
    });
  });

  describe('mergeEntities', () => {
    it('combines sourceNoteIds from both entities', () => {
      const keep = makeEntity('e1', 'React', ['n1', 'n2']);
      const remove = makeEntity('e2', 'ReactJS', ['n2', 'n3']);
      const relations: GraphRelation[] = [];
      const result = mergeEntities(keep, remove, relations);
      expect(result.mergedEntity.sourceNoteIds).toContain('n1');
      expect(result.mergedEntity.sourceNoteIds).toContain('n2');
      expect(result.mergedEntity.sourceNoteIds).toContain('n3');
    });

    it('deduplicates sourceNoteIds', () => {
      const keep = makeEntity('e1', 'React', ['n1', 'n2']);
      const remove = makeEntity('e2', 'ReactJS', ['n2', 'n3']);
      const relations: GraphRelation[] = [];
      const result = mergeEntities(keep, remove, relations);
      const uniqueIds = new Set(result.mergedEntity.sourceNoteIds);
      expect(uniqueIds.size).toBe(result.mergedEntity.sourceNoteIds.length);
    });

    it('updates relations pointing to removed entity', () => {
      const keep = makeEntity('e1', 'React', ['n1']);
      const remove = makeEntity('e2', 'ReactJS', ['n2']);
      const relations: GraphRelation[] = [
        { id: 'r1', fromEntityId: 'e2', toEntityId: 'e3', type: 'related_to' },
        { id: 'r2', fromEntityId: 'e3', toEntityId: 'e2', type: 'mentions' },
        { id: 'r3', fromEntityId: 'e3', toEntityId: 'e4', type: 'related_to' },
      ];
      const result = mergeEntities(keep, remove, relations);
      // r1 should now point from e1
      const r1 = result.updatedRelations.find((r) => r.id === 'r1');
      expect(r1!.fromEntityId).toBe('e1');
      // r2 should now point to e1
      const r2 = result.updatedRelations.find((r) => r.id === 'r2');
      expect(r2!.toEntityId).toBe('e1');
      // r3 should be unchanged
      const r3 = result.updatedRelations.find((r) => r.id === 'r3');
      expect(r3!.fromEntityId).toBe('e3');
      expect(r3!.toEntityId).toBe('e4');
    });

    it('preserves the keep entity id', () => {
      const keep = makeEntity('e1', 'React', ['n1']);
      const remove = makeEntity('e2', 'ReactJS', ['n2']);
      const result = mergeEntities(keep, remove, []);
      expect(result.mergedEntity.id).toBe('e1');
      expect(result.mergedEntity.name).toBe('React');
    });
  });
});
