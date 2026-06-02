import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeDatabase } from '$lib/server/database';
import { getLatestWikiMutation } from './latestMutation';

const dbs: Database.Database[] = [];

afterEach(() => {
  while (dbs.length > 0) dbs.pop()?.close();
});

describe('getLatestWikiMutation', () => {
  it('returns the newest mutation with parsed id arrays', () => {
    const db = new Database(':memory:');
    dbs.push(db);
    initializeDatabase(db);
    db.prepare(`
      INSERT INTO wiki_mutations (
        id, userId, runId, timestamp, triggerType,
        sourceIdsJson, changedPageIdsJson, createdPageIdsJson, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('mutation-1', 'user-1', 'run-1', 1, 'ingest', '["source-1"]', '["page-1"]', '["page-1"]', 'Old');
    db.prepare(`
      INSERT INTO wiki_mutations (
        id, userId, runId, timestamp, triggerType,
        sourceIdsJson, changedPageIdsJson, createdPageIdsJson, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('mutation-2', 'user-1', 'run-2', 2, 'ingest', '["source-2"]', '["page-2"]', '["page-2"]', 'New');

    expect(getLatestWikiMutation(db, 'user-1')).toMatchObject({
      id: 'mutation-2',
      notes: 'New',
      sourceIds: ['source-2'],
      changedPageIds: ['page-2'],
      createdPageIds: ['page-2'],
    });
  });
});
