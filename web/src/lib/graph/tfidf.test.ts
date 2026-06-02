import { describe, it, expect } from 'vitest';
import { computeTFIDF, getTopTerms } from './tfidf';

describe('tfidf', () => {
  describe('computeTFIDF', () => {
    it('returns a map keyed by document id', () => {
      const docs = [
        { id: 'doc1', text: 'hello world' },
        { id: 'doc2', text: 'hello there' },
      ];
      const result = computeTFIDF(docs);
      expect(result.has('doc1')).toBe(true);
      expect(result.has('doc2')).toBe(true);
    });

    it('computes higher TF-IDF for unique terms', () => {
      const docs = [
        { id: 'doc1', text: 'cat cat dog' },
        { id: 'doc2', text: 'dog fish fish' },
      ];
      const result = computeTFIDF(docs);
      const doc1Scores = result.get('doc1')!;
      // "cat" is unique to doc1, "dog" appears in both
      expect(doc1Scores.get('cat')!).toBeGreaterThan(doc1Scores.get('dog')!);
    });

    it('gives zero TF-IDF to terms appearing in all documents', () => {
      const docs = [
        { id: 'doc1', text: 'the cat' },
        { id: 'doc2', text: 'the dog' },
      ];
      const result = computeTFIDF(docs);
      // "the" appears in all docs → IDF = log(2/2) = 0 → TF-IDF = 0
      expect(result.get('doc1')!.get('the')).toBe(0);
    });

    it('handles a single document', () => {
      const docs = [{ id: 'doc1', text: 'hello world hello' }];
      const result = computeTFIDF(docs);
      expect(result.get('doc1')!.has('hello')).toBe(true);
      // With 1 doc, IDF = log(1/1) = 0 for all terms
      expect(result.get('doc1')!.get('hello')).toBe(0);
    });

    it('handles empty documents', () => {
      const docs = [{ id: 'doc1', text: '' }];
      const result = computeTFIDF(docs);
      expect(result.get('doc1')!.size).toBe(0);
    });

    it('lowercases all terms', () => {
      const docs = [
        { id: 'doc1', text: 'Hello WORLD' },
        { id: 'doc2', text: 'goodbye' },
      ];
      const result = computeTFIDF(docs);
      const doc1 = result.get('doc1')!;
      expect(doc1.has('hello')).toBe(true);
      expect(doc1.has('world')).toBe(true);
      expect(doc1.has('Hello')).toBe(false);
    });
  });

  describe('getTopTerms', () => {
    it('returns top K terms sorted by score descending', () => {
      const scores = new Map<string, number>([
        ['alpha', 0.5],
        ['beta', 0.9],
        ['gamma', 0.1],
        ['delta', 0.7],
      ]);
      const top = getTopTerms(scores, 2);
      expect(top).toHaveLength(2);
      expect(top[0].term).toBe('beta');
      expect(top[1].term).toBe('delta');
    });

    it('defaults to 10 if topK not provided', () => {
      const scores = new Map<string, number>();
      for (let i = 0; i < 15; i++) {
        scores.set(`term${i}`, i * 0.1);
      }
      const top = getTopTerms(scores);
      expect(top).toHaveLength(10);
    });

    it('returns all terms if fewer than topK', () => {
      const scores = new Map<string, number>([
        ['a', 1],
        ['b', 2],
      ]);
      const top = getTopTerms(scores, 5);
      expect(top).toHaveLength(2);
    });

    it('returns empty array for empty map', () => {
      const top = getTopTerms(new Map(), 5);
      expect(top).toEqual([]);
    });
  });
});
