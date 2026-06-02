import { describe, it, expect } from 'vitest';
import { buildCooccurrenceMatrix, computePMI } from './cooccurrence';

describe('cooccurrence', () => {
  describe('buildCooccurrenceMatrix', () => {
    it('counts co-occurrences of entity pairs in documents', () => {
      const docs = [
        { id: 'doc1', entityNames: ['A', 'B', 'C'] },
        { id: 'doc2', entityNames: ['A', 'B'] },
      ];
      const matrix = buildCooccurrenceMatrix(docs);
      // A-B co-occur in 2 docs
      expect(matrix.get('A')!.get('B')).toBe(2);
      // A-C co-occur in 1 doc
      expect(matrix.get('A')!.get('C')).toBe(1);
      // B-C co-occur in 1 doc
      expect(matrix.get('B')!.get('C')).toBe(1);
    });

    it('is symmetric', () => {
      const docs = [{ id: 'doc1', entityNames: ['X', 'Y'] }];
      const matrix = buildCooccurrenceMatrix(docs);
      expect(matrix.get('X')!.get('Y')).toBe(matrix.get('Y')!.get('X'));
    });

    it('handles documents with single entity', () => {
      const docs = [{ id: 'doc1', entityNames: ['A'] }];
      const matrix = buildCooccurrenceMatrix(docs);
      // A has no co-occurrences
      expect(matrix.get('A')?.size ?? 0).toBe(0);
    });

    it('handles empty entity lists', () => {
      const docs = [{ id: 'doc1', entityNames: [] }];
      const matrix = buildCooccurrenceMatrix(docs);
      expect(matrix.size).toBe(0);
    });

    it('does not count self-co-occurrence', () => {
      const docs = [{ id: 'doc1', entityNames: ['A', 'A', 'B'] }];
      const matrix = buildCooccurrenceMatrix(docs);
      expect(matrix.get('A')?.get('A')).toBeUndefined();
    });
  });

  describe('computePMI', () => {
    it('computes PMI correctly for independent entities', () => {
      // A and B each appear in 1 of 4 docs, co-occur in 1
      const cooccurrence = new Map([
        ['A', new Map([['B', 1]])],
        ['B', new Map([['A', 1]])],
      ]);
      const freq = new Map([
        ['A', 1],
        ['B', 1],
      ]);
      const pmi = computePMI(cooccurrence, freq, 4);
      // PMI = log2((1/4) / ((1/4) * (1/4))) = log2(4) = 2
      expect(pmi.get('A')!.get('B')!).toBeCloseTo(2, 5);
    });

    it('returns negative PMI when entities co-occur less than expected', () => {
      // A in 3 docs, B in 3 docs, co-occur in 1 of 4
      const cooccurrence = new Map([
        ['A', new Map([['B', 1]])],
        ['B', new Map([['A', 1]])],
      ]);
      const freq = new Map([
        ['A', 3],
        ['B', 3],
      ]);
      const pmi = computePMI(cooccurrence, freq, 4);
      // PMI = log2((1/4) / ((3/4)*(3/4))) = log2(4/9) < 0
      expect(pmi.get('A')!.get('B')!).toBeLessThan(0);
    });

    it('returns zero PMI when co-occurrence matches expectation', () => {
      // A in 2 docs, B in 2 docs, co-occur in 1 of 4
      const cooccurrence = new Map([
        ['A', new Map([['B', 1]])],
        ['B', new Map([['A', 1]])],
      ]);
      const freq = new Map([
        ['A', 2],
        ['B', 2],
      ]);
      const pmi = computePMI(cooccurrence, freq, 4);
      // PMI = log2((1/4) / ((2/4)*(2/4))) = log2(1) = 0
      expect(pmi.get('A')!.get('B')!).toBeCloseTo(0, 5);
    });
  });
});
