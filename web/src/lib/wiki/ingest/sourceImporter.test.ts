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
  while (dbs.length > 0) {
    dbs.pop()?.close();
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('importSourceText', () => {
  it('imports markdown source into raw storage and stores metadata', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'mdnotes-source-import-'));
    tempDirs.push(baseDir);
    const db = new Database(':memory:');
    dbs.push(db);
    initializeDatabase(db);

    const result = importSourceText({
      db,
      userId: 'user-1',
      baseDir,
      title: 'LLM Wiki Notes',
      content: '# LLM Wiki\n\nCompiled knowledge.',
      sourceType: 'note',
    });

    expect(result.record.title).toBe('LLM Wiki Notes');
    expect(result.record.sourceType).toBe('note');
    expect(result.record.rawPath).toMatch(/^raw\//);
    expect(readFileSync(result.absolutePath, 'utf-8')).toBe('# LLM Wiki\n\nCompiled knowledge.');

    const row = db
      .prepare('SELECT id, userId, title, slug, rawPath, sourceType, status, summaryPageId FROM raw_sources WHERE id = ?')
      .get(result.record.id) as Record<string, string>;

    expect(row).toEqual({
      id: result.record.id,
      userId: 'user-1',
      title: 'LLM Wiki Notes',
      slug: result.record.slug,
      rawPath: result.record.rawPath,
      sourceType: 'note',
      status: 'ingested',
      summaryPageId: result.record.summaryPageId,
    });
  });

  it('imports pasted text as markdown when no source type is provided', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'mdnotes-source-import-'));
    tempDirs.push(baseDir);
    const db = new Database(':memory:');
    dbs.push(db);
    initializeDatabase(db);

    const result = importSourceText({
      db,
      userId: 'user-2',
      baseDir,
      title: 'Scratch capture',
      content: 'plain text content',
    });

    expect(result.record.sourceType).toBe('manual');
    expect(result.absolutePath.endsWith('.md')).toBe(true);
    expect(readFileSync(result.absolutePath, 'utf-8')).toBe('plain text content');
  });

  it('preserves duplicate source titles with unique raw and wiki paths', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'mdnotes-source-import-'));
    tempDirs.push(baseDir);
    const db = new Database(':memory:');
    dbs.push(db);
    initializeDatabase(db);

    const first = importSourceText({
      db,
      userId: 'user-1',
      baseDir,
      title: 'Duplicate Title',
      content: 'first source content',
    });
    const second = importSourceText({
      db,
      userId: 'user-1',
      baseDir,
      title: 'Duplicate Title',
      content: 'second source content',
    });

    expect(first.record.rawPath).not.toBe(second.record.rawPath);
    expect(readFileSync(first.absolutePath, 'utf-8')).toBe('first source content');
    expect(readFileSync(second.absolutePath, 'utf-8')).toBe('second source content');

    const wikiPaths = db.prepare('SELECT wikiPath FROM wiki_pages WHERE pageType = ? ORDER BY lastUpdatedAt ASC').all('source-summary') as Array<{ wikiPath: string }>;
    expect(wikiPaths).toHaveLength(2);
    expect(new Set(wikiPaths.map((row) => row.wikiPath)).size).toBe(2);
  });
});
