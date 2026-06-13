import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeDatabase } from './database';

const dbs: Database.Database[] = [];

async function loadNotesFileWithDb(db: Database.Database) {
  vi.resetModules();
  vi.doMock('./database', () => ({ getDb: () => db }));
  return import('./notesFile');
}

afterEach(() => {
  vi.doUnmock('./database');
  while (dbs.length > 0) dbs.pop()?.close();
});

describe('upsertNote', () => {
  it('increments version from the existing server row, not the client payload', async () => {
    const db = new Database(':memory:');
    dbs.push(db);
    initializeDatabase(db);
    const { upsertNote, readNote } = await loadNotesFileWithDb(db);

    upsertNote('u1', { id: 'n1', title: 'A', content: 'one', dateModified: 1, isPinned: false, version: 0 } as any);
    upsertNote('u1', { id: 'n1', title: 'A', content: 'two', dateModified: 2, isPinned: false, version: 0 } as any);

    expect((readNote('u1', 'n1') as any)?.version).toBe(2);
  });

  it('rejects stale expectedVersion writes', async () => {
    const db = new Database(':memory:');
    dbs.push(db);
    initializeDatabase(db);
    const { upsertNote, readNote } = await loadNotesFileWithDb(db);

    upsertNote('u1', { id: 'n1', title: 'A', content: 'one', dateModified: 1, isPinned: false } as any);
    const result = upsertNote('u1', { id: 'n1', title: 'A', content: 'stale', dateModified: 2, isPinned: false } as any, 0);

    expect(result).toMatchObject({ ok: false, conflict: true });
    expect(readNote('u1', 'n1')?.content).toBe('one');
  });
});
