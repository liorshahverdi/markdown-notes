import { describe, it, expect } from 'vitest';
import { createImprovement, canUndo, dedupeImprovements, improvementDedupeKey } from './improvementLog';
import type { ImprovementRecord } from './improvementLog';

describe('improvementLog', () => {
  describe('createImprovement', () => {
    it('generates a unique id', () => {
      const record = createImprovement({
        type: 'relationship_added',
        description: 'Added relation between A and B',
        affectedIds: ['e1', 'e2'],
        confidence: 0.9,
        status: 'auto-applied',
      });
      expect(record.id).toBeTruthy();
      expect(typeof record.id).toBe('string');
    });

    it('sets a timestamp', () => {
      const before = Date.now();
      const record = createImprovement({
        type: 'entity_merged',
        description: 'Merged React and ReactJS',
        affectedIds: ['e1', 'e2'],
        confidence: 0.95,
        status: 'auto-applied',
      });
      expect(record.timestamp).toBeGreaterThanOrEqual(before);
      expect(record.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('preserves all provided fields', () => {
      const record = createImprovement({
        type: 'implicit_extracted',
        description: 'Found causal relation',
        affectedIds: ['e1', 'e2'],
        confidence: 0.7,
        status: 'pending-review',
        undoData: { previousRelations: [] },
      });
      expect(record.type).toBe('implicit_extracted');
      expect(record.description).toBe('Found causal relation');
      expect(record.affectedIds).toEqual(['e1', 'e2']);
      expect(record.confidence).toBe(0.7);
      expect(record.status).toBe('pending-review');
      expect(record.undoData).toEqual({ previousRelations: [] });
    });

    it('generates different ids for different records', () => {
      const r1 = createImprovement({
        type: 'relationship_added',
        description: 'A',
        affectedIds: [],
        confidence: 0.5,
        status: 'auto-applied',
      });
      const r2 = createImprovement({
        type: 'relationship_added',
        description: 'B',
        affectedIds: [],
        confidence: 0.5,
        status: 'auto-applied',
      });
      expect(r1.id).not.toBe(r2.id);
    });
  });

  describe('dedupeImprovements', () => {
    it('deduplicates repeated relationship proposals even when one affectedIds list includes a source note', () => {
      const base: ImprovementRecord = {
        id: 'old',
        timestamp: 1,
        type: 'implicit_extracted',
        description: 'Implicit link A to B from note 1',
        affectedIds: ['a', 'b', 'note-1'],
        confidence: 0.6,
        status: 'pending-review',
        undoData: { relation: { fromEntityId: 'a', toEntityId: 'b', type: 'related_to' } },
      } as ImprovementRecord;
      const duplicate: ImprovementRecord = {
        ...base,
        id: 'new',
        timestamp: 2,
        description: 'Implicit link A to B from note 2',
        affectedIds: ['b', 'a', 'note-2'],
      };

      expect(improvementDedupeKey(base)).toBe(improvementDedupeKey(duplicate));
      expect(dedupeImprovements([base, duplicate]).map((record) => record.id)).toEqual(['new']);
    });

    it('keeps different proposal types for the same pair separate', () => {
      const relationship: ImprovementRecord = {
        id: 'rel',
        timestamp: 1,
        type: 'relationship_added',
        description: 'Link A and B',
        affectedIds: ['a', 'b'],
        confidence: 0.7,
        status: 'pending-review',
      };
      const merge: ImprovementRecord = {
        ...relationship,
        id: 'merge',
        type: 'entity_merged',
        description: 'Merge A and B',
      };

      expect(dedupeImprovements([relationship, merge])).toHaveLength(2);
    });
  });

  describe('canUndo', () => {
    it('returns true for auto-applied records with undoData', () => {
      const record: ImprovementRecord = {
        id: '1',
        timestamp: Date.now(),
        type: 'relationship_added',
        description: 'Test',
        affectedIds: ['e1'],
        confidence: 0.9,
        status: 'auto-applied',
        undoData: { removedRelationId: 'r1' },
      };
      expect(canUndo(record)).toBe(true);
    });

    it('returns false for records without undoData', () => {
      const record: ImprovementRecord = {
        id: '1',
        timestamp: Date.now(),
        type: 'relationship_added',
        description: 'Test',
        affectedIds: ['e1'],
        confidence: 0.9,
        status: 'auto-applied',
      };
      expect(canUndo(record)).toBe(false);
    });

    it('returns false for rejected records', () => {
      const record: ImprovementRecord = {
        id: '1',
        timestamp: Date.now(),
        type: 'entity_merged',
        description: 'Test',
        affectedIds: ['e1'],
        confidence: 0.9,
        status: 'rejected',
        undoData: { data: true },
      };
      expect(canUndo(record)).toBe(false);
    });

    it('returns false for already undone records', () => {
      const record: ImprovementRecord = {
        id: '1',
        timestamp: Date.now(),
        type: 'entity_merged',
        description: 'Test',
        affectedIds: ['e1'],
        confidence: 0.9,
        status: 'undone',
        undoData: { data: true },
      };
      expect(canUndo(record)).toBe(false);
    });
  });
});
