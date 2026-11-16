import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeDatabase } from '$lib/server/database';
import type { NoteRecord } from '../../../../types/note';

const dbs: Database.Database[] = [];
const notes: NoteRecord[] = [
  { id: 'n1', title: 'One', content: '# One\n\nSome text that is long enough to matter here.', dateModified: 1, isPinned: false },
];

afterEach(() => {
  vi.doUnmock('$lib/server/database');
  vi.doUnmock('$lib/server/notesFile');
  while (dbs.length) dbs.pop()?.close();
});

describe('GET /api/graph/status', () => {
  it("returns the user's review queue and model backlog", async () => {
    const db = new Database(':memory:');
    dbs.push(db);
    initializeDatabase(db);
    db.prepare(`INSERT INTO graph_proposals (id, userId, dedupeKey, kind, source, status, confidence, description, payloadJson, createdAt)
      VALUES ('p1', 'user-1', 'k1', 'merge', 'duplicate', 'pending', 0.9, 'x', '{}', 1),
             ('p2', 'other', 'k2', 'merge', 'duplicate', 'pending', 0.9, 'x', '{}', 1)`).run();
    vi.resetModules();
    vi.doMock('$lib/server/database', () => ({ getDb: () => db }));
    vi.doMock('$lib/server/notesFile', () => ({ readNotes: () => notes, readFolders: () => [] }));
    const route = await import('./+server');

    const response = await route.GET({ locals: { user: { id: 'user-1', username: 't' } } } as Parameters<typeof route.GET>[0]);
    expect(await response.json()).toMatchObject({ pendingReview: 1, queuedNotes: 1, running: false, modelSkipped: false });
  });
});
