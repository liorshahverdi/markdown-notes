import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeDatabase } from '$lib/server/database';
import { upsertConceptPages } from './conceptPageUpdater';

const tempDirs: string[] = [];
const dbs: Database.Database[] = [];

afterEach(() => {
  while (dbs.length > 0) dbs.pop()?.close();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('upsertConceptPages', () => {
  it('creates concept pages and merges source ids when a concept already exists', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'mdnotes-concept-pages-'));
    tempDirs.push(baseDir);
    const db = new Database(':memory:');
    dbs.push(db);
    initializeDatabase(db);

    upsertConceptPages({
      db,
      userId: 'user-1',
      baseDir,
      sourceId: 'source-1',
      sourceTitle: 'First Source',
      suggestions: [{
        title: 'symbolic programming',
        slug: 'symbolic-programming',
        pageType: 'concept',
        summary: 'Mentioned in First Source.',
        entityKeys: ['concept:symbolic-programming'],
        relatedEntityKeys: [],
        sourceIds: ['source-1'],
      }],
    });

    const result = upsertConceptPages({
      db,
      userId: 'user-1',
      baseDir,
      sourceId: 'source-2',
      sourceTitle: 'Second Source',
      suggestions: [{
        title: 'symbolic programming',
        slug: 'symbolic-programming',
        pageType: 'concept',
        summary: 'Mentioned in Second Source.',
        entityKeys: ['concept:symbolic-programming'],
        relatedEntityKeys: [],
        sourceIds: ['source-2'],
      }],
    });

    expect(result.createdPageIds).toEqual([]);
    expect(result.changedPageIds).toHaveLength(1);

    const row = db.prepare('SELECT sourceIdsJson FROM wiki_pages WHERE slug = ?').get('symbolic-programming') as Record<string, string>;
    expect(JSON.parse(row.sourceIdsJson)).toEqual(['source-1', 'source-2']);

    const markdown = readFileSync(join(baseDir, 'vaults', 'user-1', 'wiki', 'concepts', 'symbolic-programming.md'), 'utf-8');
    expect(markdown).toContain('[[sources/source-1|First Source]]');
    expect(markdown).toContain('[[sources/source-2|Second Source]]');
  });
});
