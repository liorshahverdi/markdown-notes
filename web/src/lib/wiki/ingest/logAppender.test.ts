import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeDatabase } from '$lib/server/database';
import { readVaultTextFile } from '$lib/server/vaultFs';
import { getUserVaultPaths } from '$lib/server/vaultPaths';
import { appendWikiLogEntry } from './logAppender';

const tempDirs: string[] = [];
const dbs: Database.Database[] = [];

afterEach(() => {
  while (dbs.length > 0) dbs.pop()?.close();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('appendWikiLogEntry', () => {
  it('appends a chronological ingest entry and records changed/source ids', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'mdnotes-log-appender-'));
    tempDirs.push(baseDir);
    const db = new Database(':memory:');
    dbs.push(db);
    initializeDatabase(db);

    appendWikiLogEntry({
      db,
      userId: 'user-1',
      baseDir,
      timestamp: Date.UTC(2026, 5, 1, 12, 0, 0),
      triggerType: 'ingest',
      sourceIds: ['source-1'],
      changedPageIds: ['page-1', 'wiki-index'],
      createdPageIds: ['page-1'],
      notes: 'Imported LLM Wiki Notes',
    });

    const vaultRoot = getUserVaultPaths('user-1', baseDir).root;
    const markdown = readVaultTextFile(vaultRoot, 'wiki/log.md');
    expect(markdown).toContain('2026-06-01T12:00:00.000Z');
    expect(markdown).toContain('source-1');
    expect(markdown).toContain('page-1');

    const row = db.prepare('SELECT triggerType, sourceIdsJson, changedPageIdsJson FROM wiki_mutations').get() as Record<string, string>;
    expect(row.triggerType).toBe('ingest');
    expect(JSON.parse(row.sourceIdsJson)).toEqual(['source-1']);
    expect(JSON.parse(row.changedPageIdsJson)).toEqual(['page-1', 'wiki-index']);
  });
});
