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

describe('cross-page integration during ingest', () => {
  it('updates source summary, entity pages, index, and log from one source import', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'mdnotes-cross-pages-'));
    tempDirs.push(baseDir);
    const db = new Database(':memory:');
    dbs.push(db);
    initializeDatabase(db);

    const result = importSourceText({
      db,
      userId: 'user-1',
      baseDir,
      title: 'Computing History',
      content: 'Ada Lovelace studied the Analytical Engine. Ada Lovelace wrote notes about the Analytical Engine.',
      sourceType: 'note',
    });

    const pageRows = db.prepare('SELECT pageType, slug FROM wiki_pages ORDER BY pageType, slug').all() as Array<{ pageType: string; slug: string }>;
    expect(pageRows).toEqual(expect.arrayContaining([
      { pageType: 'source-summary', slug: result.record.slug },
      { pageType: 'entity', slug: 'ada-lovelace' },
      { pageType: 'entity', slug: 'analytical-engine' },
      { pageType: 'index', slug: 'index' },
      { pageType: 'log', slug: 'log' },
    ]));

    const indexMarkdown = readFileSync(join(baseDir, 'vaults', 'user-1', 'wiki', 'index.md'), 'utf-8');
    expect(indexMarkdown).toContain('[[entities/ada-lovelace|Ada Lovelace]]');
    expect(indexMarkdown).toContain(`[[sources/${result.record.slug}|Computing History]]`);

    const logMarkdown = readFileSync(join(baseDir, 'vaults', 'user-1', 'wiki', 'log.md'), 'utf-8');
    expect(logMarkdown).toContain(result.record.id);
    expect(logMarkdown).toContain('ada-lovelace');
  });
});
