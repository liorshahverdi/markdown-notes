import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeDatabase } from '$lib/server/database';

const dbs: Database.Database[] = [];

async function loadIndexWithDb(db: Database.Database) {
  vi.resetModules();
  vi.doMock('$lib/server/database', () => ({ getDb: () => db }));
  return import('./localMemoryIndex');
}

afterEach(() => {
  vi.doUnmock('$lib/server/database');
  while (dbs.length > 0) dbs.pop()?.close();
});

describe('local memory index', () => {
  it('persists note chunks and reuses them for semantic search', async () => {
    const db = new Database(':memory:');
    dbs.push(db);
    initializeDatabase(db);
    const { indexNoteMemory, searchLocalMemory } = await loadIndexWithDb(db);
    const embedTexts = vi.fn(async (texts: string[]) =>
      texts.map((text) => (text.toLowerCase().includes('memory beacon') ? [1, 0] : [0, 1]))
    );

    await indexNoteMemory({
      userId: 'u1',
      note: {
        id: 'n1',
        title: 'Quantum Marmot',
        content: 'The Quantum Marmot project uses Memory Beacon for graph recall.',
        dateModified: 1,
        isPinned: false,
      },
      embedTexts,
    });

    expect(db.prepare('SELECT COUNT(*) AS count FROM memory_chunks').get()).toMatchObject({ count: 1 });

    const results = await searchLocalMemory({ userId: 'u1', query: 'graph recall memory beacon', topK: 3, embedTexts });

    expect(results[0]).toMatchObject({
      noteId: 'n1',
      title: 'Quantum Marmot',
      score: 1,
    });
    expect(results[0].chunkText).toContain('Memory Beacon');
  });

  it('replaces stale chunks when a note changes', async () => {
    const db = new Database(':memory:');
    dbs.push(db);
    initializeDatabase(db);
    const { indexNoteMemory } = await loadIndexWithDb(db);
    const embedTexts = vi.fn(async (texts: string[]) => texts.map(() => [1, 0]));

    await indexNoteMemory({
      userId: 'u1',
      note: { id: 'n1', title: 'Old', content: 'old memory', dateModified: 1, isPinned: false },
      embedTexts,
    });
    await indexNoteMemory({
      userId: 'u1',
      note: { id: 'n1', title: 'New', content: 'new memory', dateModified: 2, isPinned: false },
      embedTexts,
    });

    const rows = db.prepare('SELECT title, chunkText FROM memory_chunks WHERE userId = ? AND noteId = ?').all('u1', 'n1');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: 'New' });
    expect((rows[0] as { chunkText: string }).chunkText).toContain('new memory');
  });
});
