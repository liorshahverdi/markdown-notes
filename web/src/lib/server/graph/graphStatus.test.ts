import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeDatabase } from '../database';
import type { NoteRecord } from '../../../types/note';
import { getGraphStatus, runGraphPass, type LlmDeps } from './graphWorker';

const dbs: Database.Database[] = [];
afterEach(() => {
  while (dbs.length) dbs.pop()?.close();
});

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  initializeDatabase(db);
  dbs.push(db);
  return db;
}

const long = 'This paragraph is long enough for the model stages to look at it.';
function note(id: string, dateModified = 1): NoteRecord {
  return { id, title: `Note ${id}`, content: `# Note ${id}\n\n${long}`, dateModified, isPinned: false };
}

const quietLlm: LlmDeps = {
  healthy: async () => true,
  complete: async (prompt) => JSON.stringify(prompt.includes('corrections') ? { corrections: [], missed: [] } : { relations: [] }),
};

describe('getGraphStatus', () => {
  it('reports every note as queued and the model as never run before any pass', () => {
    const db = freshDb();
    const status = getGraphStatus(db, 'u', [note('a'), note('b')]);
    expect(status).toMatchObject({ pendingReview: 0, queuedNotes: 2, running: false, lastRun: null, modelSkipped: false });
  });

  it('counts the review queue and remaining model work, and flags passes that skipped the model', async () => {
    const db = freshDb();
    const notes = [note('a', 3), note('b', 2), note('c', 1)];
    await runGraphPass({ db, userId: 'u', notes, folders: [], trigger: 'test', llm: quietLlm, llmNoteBudget: 1 });
    expect(getGraphStatus(db, 'u', notes)).toMatchObject({ queuedNotes: 2, modelSkipped: false });

    await runGraphPass({ db, userId: 'u', notes, folders: [], trigger: 'schedule', llm: { ...quietLlm, healthy: async () => false } });
    const status = getGraphStatus(db, 'u', notes);
    expect(status.modelSkipped).toBe(true);
    expect(status.lastRun).toMatchObject({ trigger: 'schedule', status: 'completed' });
  });

  it('reports a pass as running while it is in flight', async () => {
    const db = freshDb();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const llm: LlmDeps = { healthy: async () => { await gate; return false; }, complete: quietLlm.complete };
    const pass = runGraphPass({ db, userId: 'u', notes: [note('a')], folders: [], trigger: 'test', llm });
    await Promise.resolve();
    expect(getGraphStatus(db, 'u', [note('a')]).running).toBe(true);
    release();
    await pass;
    expect(getGraphStatus(db, 'u', [note('a')]).running).toBe(false);
  });
});
