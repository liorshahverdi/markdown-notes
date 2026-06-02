import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeDatabase } from '$lib/server/database';
import { readVaultTextFile } from '$lib/server/vaultFs';
import { getUserVaultPaths } from '$lib/server/vaultPaths';
import { saveWikiPage } from './wikiPageRepository';

const tempDirs: string[] = [];
const dbs: Database.Database[] = [];

afterEach(() => {
  while (dbs.length > 0) dbs.pop()?.close();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('saveWikiPage', () => {
  it('writes page markdown and caches the record in sqlite', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'mdnotes-wiki-page-'));
    tempDirs.push(baseDir);
    const db = new Database(':memory:');
    dbs.push(db);
    initializeDatabase(db);

    saveWikiPage({
      db,
      userId: 'user-1',
      baseDir,
      markdown: '---\npageType: source-summary\nsourceIds:\n  - source-1\n---\n# LLM Wiki Notes',
      record: {
        id: 'page-1',
        title: 'LLM Wiki Notes',
        slug: 'llm-wiki-notes',
        pageType: 'source-summary',
        wikiPath: 'wiki/sources/llm-wiki-notes.md',
        summary: 'Compiled wiki notes',
        backlinks: ['index'],
        sourceIds: ['source-1'],
        entityKeys: ['llm-wiki'],
        lastUpdatedAt: 1717286400000,
        lastUpdatedReason: 'ingest',
        confidence: 'medium',
        openQuestions: ['How should index maintenance work?'],
      },
    });

    const vaultRoot = getUserVaultPaths('user-1', baseDir).root;
    expect(readVaultTextFile(vaultRoot, 'wiki/sources/llm-wiki-notes.md')).toContain('# LLM Wiki Notes');

    const row = db.prepare('SELECT wikiPath, backlinksJson, sourceIdsJson, openQuestionsJson FROM wiki_pages WHERE id = ?').get('page-1') as Record<string, string>;
    expect(row.wikiPath).toBe('wiki/sources/llm-wiki-notes.md');
    expect(JSON.parse(row.backlinksJson)).toEqual(['index']);
    expect(JSON.parse(row.sourceIdsJson)).toEqual(['source-1']);
    expect(JSON.parse(row.openQuestionsJson)).toEqual(['How should index maintenance work?']);
  });
});
