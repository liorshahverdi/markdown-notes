import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeDatabase } from '$lib/server/database';
import { upsertEntityPages } from './entityPageUpdater';

const tempDirs: string[] = [];
const dbs: Database.Database[] = [];

afterEach(() => {
  while (dbs.length > 0) dbs.pop()?.close();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('upsertEntityPages', () => {
  it('creates entity pages linked to source and related entity keys', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'mdnotes-entity-pages-'));
    tempDirs.push(baseDir);
    const db = new Database(':memory:');
    dbs.push(db);
    initializeDatabase(db);

    const result = upsertEntityPages({
      db,
      userId: 'user-1',
      baseDir,
      sourceId: 'source-1',
      sourceTitle: 'Computing Notes',
      suggestions: [
        {
          title: 'Ada Lovelace',
          slug: 'ada-lovelace',
          pageType: 'entity',
          summary: 'Mentioned in Computing Notes.',
          entityKeys: ['person:ada-lovelace'],
          relatedEntityKeys: ['object:analytical-engine'],
          sourceIds: ['source-1'],
        },
      ],
    });

    expect(result.createdPageIds).toHaveLength(1);
    expect(result.changedPageIds).toEqual(result.createdPageIds);

    const row = db.prepare('SELECT title, pageType, sourceIdsJson, entityKeysJson FROM wiki_pages WHERE slug = ?').get('ada-lovelace') as Record<string, string>;
    expect(row.title).toBe('Ada Lovelace');
    expect(row.pageType).toBe('entity');
    expect(JSON.parse(row.sourceIdsJson)).toEqual(['source-1']);
    expect(JSON.parse(row.entityKeysJson)).toEqual(['person:ada-lovelace']);

    const markdown = readFileSync(join(baseDir, 'vaults', 'user-1', 'wiki', 'entities', 'ada-lovelace.md'), 'utf-8');
    expect(markdown).toContain('# Ada Lovelace');
    expect(markdown).toContain('[[sources/source-1|Computing Notes]]');
    expect(markdown).toContain('object:analytical-engine');
  });
});
