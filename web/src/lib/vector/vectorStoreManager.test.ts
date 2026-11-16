import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { notes } from '../stores/notes';
import { db } from '../db';
import { initVectorStore, searchNotes, destroyVectorStore, vectorStoreReady } from './vectorStoreManager';

const note = (id: string, title: string, content: string, folderId?: string) => ({ id, title, content, folderId, dateModified: 1, isPinned: false });
beforeEach(() => { destroyVectorStore(); notes.set([]); });
afterEach(() => { destroyVectorStore(); notes.set([]); vi.unstubAllGlobals(); });

describe('keyword retrieval without model inference', () => {
  it('returns no results before initialization', async () => { expect(await searchNotes('hello')).toEqual([]); });
  it('ranks title matches above body matches and excludes unrelated notes', async () => {
    notes.set([note('body', 'Budget', 'Planning vacation'), note('title', 'Vacation', 'Travel plan'), note('other', 'Work', 'Engineering')]);
    await initVectorStore();
    expect(get(vectorStoreReady)).toBe(true);
    expect((await searchNotes('vacation')).map(r => r.noteId)).toEqual(['title', 'body']);
  });
  it('does not fetch, launch workers or change stored embeddings', async () => {
    const fetchMock = vi.fn(); const worker = vi.fn(); vi.stubGlobal('fetch', fetchMock); vi.stubGlobal('Worker', worker);
    const old = { id: 'migration-preserved', noteId: 'old', textHash: 'old', chunkText: 'old text', vector: [1, 0] };
    await db.embeddings.put(old);
    notes.set([note('new', 'Notes', 'Keyword evidence')]);
    await initVectorStore(); await searchNotes('evidence');
    expect(fetchMock).not.toHaveBeenCalled(); expect(worker).not.toHaveBeenCalled();
    expect(await db.embeddings.get(old.id)).toEqual(old);
    await db.embeddings.delete(old.id);
  });
  it('reflects edits immediately and obeys result limits', async () => {
    await initVectorStore(); notes.set([note('1', 'Alpha', 'alpha'), note('2', 'Alpha', 'alpha')]);
    expect(await searchNotes('alpha', 1)).toHaveLength(1);
    notes.set([note('3', 'Beta', 'beta')]); expect(await searchNotes('alpha')).toEqual([]);
    expect((await searchNotes('beta'))[0].noteId).toBe('3');
  });
  it('can initialize repeatedly and cleans up readiness', async () => {
    await initVectorStore(); await initVectorStore(); destroyVectorStore();
    expect(get(vectorStoreReady)).toBe(false); expect(await searchNotes('anything')).toEqual([]);
  });
});
