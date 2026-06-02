import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeDatabase } from '$lib/server/database';
import { importSourceText } from './sourceImporter';

const tempDirs: string[] = [];
const dbs: Database.Database[] = [];

afterEach(() => {
  while (dbs.length > 0) dbs.pop()?.close();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('wiki maintenance during ingest', () => {
  it('updates wiki index and log whenever a source is imported', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'mdnotes-maintenance-'));
    tempDirs.push(baseDir);
    const db = new Database(':memory:');
    dbs.push(db);
    initializeDatabase(db);

    const result = importSourceText({
      db,
      userId: 'user-1',
      baseDir,
      title: 'LLM Wiki Notes',
      content: '# LLM Wiki\n\nCompiled knowledge should be persistent.',
      sourceType: 'note',
    });

    const indexPath = join(baseDir, 'vaults', 'user-1', 'wiki', 'index.md');
    const logPath = join(baseDir, 'vaults', 'user-1', 'wiki', 'log.md');
    expect(readFileSync(indexPath, 'utf-8')).toContain(`[[sources/${result.record.slug}|LLM Wiki Notes]]`);
    expect(readFileSync(logPath, 'utf-8')).toContain(result.record.id);
    expect(readFileSync(logPath, 'utf-8')).toContain(result.record.summaryPageId ?? '');
  });
});
