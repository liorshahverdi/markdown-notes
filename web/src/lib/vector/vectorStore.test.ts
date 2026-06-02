import { describe, it, expect, beforeEach } from 'vitest';
import { VectorStore, cosineSimilarity, chunkText, type VectorEntry } from './vectorStore';

describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    const v = [1, 2, 3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it('should return 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  it('should return -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
  });

  it('should handle normalized vectors', () => {
    const a = [0.6, 0.8];
    const b = [0.8, 0.6];
    // dot = 0.48 + 0.48 = 0.96, magnitudes = 1
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.96, 5);
  });

  it('should return 0 for zero vectors', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });

  it('should be commutative', () => {
    const a = [1, 3, -5];
    const b = [4, -2, 1];
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
  });
});

describe('chunkText', () => {
  it('should return a single chunk for short text', () => {
    const text = 'Hello world';
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('Hello world');
  });

  it('should split long text into multiple chunks', () => {
    // Create text longer than 2000 chars (default ~500 tokens * 4 chars/token)
    const paragraph = 'This is a paragraph with some content. ';
    const longText = paragraph.repeat(100); // ~3900 chars
    const chunks = chunkText(longText);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should respect custom maxTokens', () => {
    const text = 'Sentence one. Sentence two. Sentence three. Sentence four.';
    const chunks = chunkText(text, 5); // ~20 chars per chunk
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should not produce empty chunks', () => {
    const text = 'Hello.\n\n\n\nWorld.\n\n\n\nFoo.';
    const chunks = chunkText(text);
    for (const chunk of chunks) {
      expect(chunk.trim().length).toBeGreaterThan(0);
    }
  });

  it('should handle empty string', () => {
    const chunks = chunkText('');
    expect(chunks).toHaveLength(0);
  });

  it('should handle whitespace-only string', () => {
    const chunks = chunkText('   \n\n  ');
    expect(chunks).toHaveLength(0);
  });

  it('should split on paragraph boundaries when possible', () => {
    const para1 = 'A'.repeat(1500);
    const para2 = 'B'.repeat(1500);
    const text = `${para1}\n\n${para2}`;
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });
});

describe('VectorStore', () => {
  let store: VectorStore;

  const makeEntry = (id: string, noteId: string, vector: number[]): VectorEntry => ({
    id,
    noteId,
    chunkText: `chunk for ${id}`,
    vector,
  });

  beforeEach(() => {
    store = new VectorStore();
  });

  describe('add / size', () => {
    it('should start empty', () => {
      expect(store.size()).toBe(0);
    });

    it('should add a single entry', () => {
      store.add(makeEntry('n1-0', 'n1', [1, 0, 0]));
      expect(store.size()).toBe(1);
    });

    it('should add multiple entries individually', () => {
      store.add(makeEntry('n1-0', 'n1', [1, 0, 0]));
      store.add(makeEntry('n1-1', 'n1', [0, 1, 0]));
      expect(store.size()).toBe(2);
    });
  });

  describe('addBatch', () => {
    it('should add multiple entries at once', () => {
      store.addBatch([
        makeEntry('n1-0', 'n1', [1, 0, 0]),
        makeEntry('n2-0', 'n2', [0, 1, 0]),
        makeEntry('n3-0', 'n3', [0, 0, 1]),
      ]);
      expect(store.size()).toBe(3);
    });
  });

  describe('delete', () => {
    it('should remove all entries for a noteId', () => {
      store.addBatch([
        makeEntry('n1-0', 'n1', [1, 0, 0]),
        makeEntry('n1-1', 'n1', [0, 1, 0]),
        makeEntry('n2-0', 'n2', [0, 0, 1]),
      ]);
      store.delete('n1');
      expect(store.size()).toBe(1);
    });

    it('should not affect other notes', () => {
      store.addBatch([
        makeEntry('n1-0', 'n1', [1, 0, 0]),
        makeEntry('n2-0', 'n2', [0, 0, 1]),
      ]);
      store.delete('n1');
      // The remaining entry should still be searchable
      const results = store.search([0, 0, 1], 1);
      expect(results).toHaveLength(1);
      expect(results[0].entry.noteId).toBe('n2');
    });

    it('should handle deleting a non-existent noteId', () => {
      store.add(makeEntry('n1-0', 'n1', [1, 0, 0]));
      store.delete('nonexistent');
      expect(store.size()).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      store.addBatch([
        makeEntry('n1-0', 'n1', [1, 0, 0]),
        makeEntry('n2-0', 'n2', [0, 1, 0]),
      ]);
      store.clear();
      expect(store.size()).toBe(0);
    });
  });

  describe('search', () => {
    it('should return empty array when store is empty', () => {
      const results = store.search([1, 0, 0]);
      expect(results).toHaveLength(0);
    });

    it('should find the most similar vector', () => {
      store.addBatch([
        makeEntry('n1-0', 'n1', [1, 0, 0]),
        makeEntry('n2-0', 'n2', [0, 1, 0]),
        makeEntry('n3-0', 'n3', [0, 0, 1]),
      ]);
      const results = store.search([0.9, 0.1, 0], 1);
      expect(results).toHaveLength(1);
      expect(results[0].entry.noteId).toBe('n1');
    });

    it('should return results sorted by score descending', () => {
      store.addBatch([
        makeEntry('n1-0', 'n1', [1, 0, 0]),
        makeEntry('n2-0', 'n2', [0.7, 0.7, 0]),
        makeEntry('n3-0', 'n3', [0, 1, 0]),
      ]);
      const results = store.search([1, 0, 0], 3);
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      expect(results[1].score).toBeGreaterThanOrEqual(results[2].score);
    });

    it('should respect topK parameter', () => {
      store.addBatch([
        makeEntry('n1-0', 'n1', [1, 0, 0]),
        makeEntry('n2-0', 'n2', [0, 1, 0]),
        makeEntry('n3-0', 'n3', [0, 0, 1]),
      ]);
      const results = store.search([1, 1, 1], 2);
      expect(results).toHaveLength(2);
    });

    it('should default topK to 5', () => {
      for (let i = 0; i < 10; i++) {
        store.add(makeEntry(`n${i}-0`, `n${i}`, [Math.random(), Math.random(), Math.random()]));
      }
      const results = store.search([1, 1, 1]);
      expect(results).toHaveLength(5);
    });

    it('should return all entries if fewer than topK', () => {
      store.addBatch([
        makeEntry('n1-0', 'n1', [1, 0, 0]),
        makeEntry('n2-0', 'n2', [0, 1, 0]),
      ]);
      const results = store.search([1, 1, 0], 10);
      expect(results).toHaveLength(2);
    });

    it('should include score in results', () => {
      store.add(makeEntry('n1-0', 'n1', [1, 0, 0]));
      const results = store.search([1, 0, 0], 1);
      expect(results[0].score).toBeCloseTo(1, 5);
    });
  });
});
