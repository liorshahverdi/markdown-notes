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

describe('importSourceText wiki integration', () => {
  it('creates a source-summary wiki page and links it from the raw source row', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'mdnotes-wiki-integrator-'));
    tempDirs.push(baseDir);
    const db = new Database(':memory:');
    dbs.push(db);
    initializeDatabase(db);

    const result = importSourceText({
      db,
      userId: 'user-1',
      baseDir,
      title: 'LLM Wiki Notes',
      content: '# LLM Wiki\n\nCompiled knowledge should be persistent and editable.',
      sourceType: 'note',
    });

    expect(result.record.summaryPageId).toBeTruthy();

    const rawRow = db.prepare('SELECT summaryPageId, status FROM raw_sources WHERE id = ?').get(result.record.id) as Record<string, string>;
    expect(rawRow.status).toBe('ingested');
    expect(rawRow.summaryPageId).toBeTruthy();

    const wikiRow = db.prepare('SELECT wikiPath, pageType, sourceIdsJson FROM wiki_pages WHERE id = ?').get(rawRow.summaryPageId) as Record<string, string>;
    expect(wikiRow.pageType).toBe('source-summary');
    expect(JSON.parse(wikiRow.sourceIdsJson)).toEqual([result.record.id]);

    const wikiPath = join(baseDir, 'vaults', 'user-1', wikiRow.wikiPath);
    expect(readFileSync(wikiPath, 'utf-8')).toContain('## Summary');
    expect(readFileSync(wikiPath, 'utf-8')).toContain('[[raw/');
  });
});
