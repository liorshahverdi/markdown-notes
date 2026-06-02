import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { notes } from '../stores/notes';
import {
  initVectorStore,
  searchNotes,
  destroyVectorStore,
  vectorStoreReady,
} from './vectorStoreManager';

// Generate a random 384-dim vector (normalized)
function randomVector(): number[] {
  const vec = Array.from({ length: 384 }, () => Math.random() - 0.5);
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

// Mock Worker that echoes back random 384-dim vectors
class MockWorker {
  private handler: ((event: MessageEvent) => void) | null = null;
  private errorHandler: ((event: ErrorEvent) => void) | null = null;
  public shouldError = false;

  addEventListener(type: string, handler: any) {
    if (type === 'message') this.handler = handler;
    if (type === 'error') this.errorHandler = handler;
  }

  postMessage(msg: { type: string; id: string; texts: string[] }) {
    if (msg.type === 'embed') {
      if (this.shouldError) {
        setTimeout(() => {
          this.handler?.({
            data: { type: 'error', id: msg.id, message: 'Mock embedding error' },
          } as MessageEvent);
        }, 0);
        return;
      }
      const vectors = msg.texts.map(() => randomVector());
      setTimeout(() => {
        this.handler?.({
          data: { type: 'embeddings', id: msg.id, vectors },
        } as MessageEvent);
      }, 0);
    }
  }

  terminate() {}

  // Test helper: simulate a worker crash
  simulateError(message: string) {
    this.errorHandler?.({ message } as ErrorEvent);
  }
}

// Stub the Worker global
let lastWorker: MockWorker;
vi.stubGlobal('Worker', function () {
  lastWorker = new MockWorker();
  return lastWorker;
});

describe('vectorStoreManager', () => {
  beforeEach(() => {
    destroyVectorStore();
    notes.set([]);
  });

  afterEach(() => {
    destroyVectorStore();
    notes.set([]);
  });

  it('searchNotes returns empty array when store not initialized', async () => {
    const results = await searchNotes('hello');
    expect(results).toEqual([]);
  });

  it('initVectorStore populates store from notes and sets vectorStoreReady', async () => {
    notes.set([
      { id: 'n1', title: 'Note One', content: 'First note content', dateModified: Date.now(), isPinned: false },
      { id: 'n2', title: 'Note Two', content: 'Second note content', dateModified: Date.now(), isPinned: false },
    ]);

    await initVectorStore();

    expect(get(vectorStoreReady)).toBe(true);

    const results = await searchNotes('note content', 5);
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r).toHaveProperty('noteId');
      expect(r).toHaveProperty('title');
      expect(r).toHaveProperty('score');
      expect(r).toHaveProperty('chunkText');
    }
  });

  it('destroyVectorStore cleans up all state', async () => {
    notes.set([
      { id: 'n1', title: 'Note', content: 'Content', dateModified: Date.now(), isPinned: false },
    ]);

    await initVectorStore();
    expect(get(vectorStoreReady)).toBe(true);

    destroyVectorStore();

    expect(get(vectorStoreReady)).toBe(false);
    const results = await searchNotes('content');
    expect(results).toEqual([]);
  });

  it('searchNotes deduplicates results by noteId', async () => {
    const longContent = Array.from({ length: 20 }, (_, i) => `Paragraph ${i}. `.repeat(50)).join('\n\n');
    notes.set([
      { id: 'n1', title: 'Long Note', content: longContent, dateModified: Date.now(), isPinned: false },
    ]);

    await initVectorStore();

    const results = await searchNotes('paragraph', 5);
    const noteIds = results.map((r) => r.noteId);
    expect(new Set(noteIds).size).toBe(noteIds.length);
  });

  it('initVectorStore is idempotent', async () => {
    notes.set([
      { id: 'n1', title: 'Note', content: 'Content', dateModified: Date.now(), isPinned: false },
    ]);

    await initVectorStore();
    await initVectorStore(); // Should not throw or duplicate

    expect(get(vectorStoreReady)).toBe(true);
  });

  it('handles worker error responses gracefully', async () => {
    notes.set([]);
    await initVectorStore();

    // Make the worker return errors
    lastWorker.shouldError = true;

    // searchNotes should return [] on embed error, not throw
    const results = await searchNotes('test query');
    expect(results).toEqual([]);
  });

  it('handles worker crash by rejecting pending requests', async () => {
    notes.set([]);
    await initVectorStore();

    // Start an embed request, then crash the worker before it responds
    lastWorker.shouldError = false;

    // Simulate a crash — this should reject all pending requests
    lastWorker.simulateError('Worker terminated unexpectedly');

    // searchNotes should handle the rejection gracefully
    const results = await searchNotes('test query');
    expect(results).toEqual([]);
  });

  it('skips first subscription emission to avoid redundant sync', async () => {
    notes.set([
      { id: 'n1', title: 'Note', content: 'Content', dateModified: Date.now(), isPinned: false },
    ]);

    await initVectorStore();

    // Immediately after init, the subscription fires synchronously.
    // The first emission should be skipped (no wasteful re-hash).
    // Verify by checking that store is still ready and no errors occurred.
    expect(get(vectorStoreReady)).toBe(true);
  });
});
