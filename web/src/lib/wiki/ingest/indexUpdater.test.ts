import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeDatabase } from '$lib/server/database';
import { readVaultTextFile } from '$lib/server/vaultFs';
import { getUserVaultPaths } from '$lib/server/vaultPaths';
import { saveWikiPage } from '$lib/wiki/wikiPageRepository';
import { updateWikiIndex } from './indexUpdater';

const tempDirs: string[] = [];
const dbs: Database.Database[] = [];

afterEach(() => {
  while (dbs.length > 0) dbs.pop()?.close();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('updateWikiIndex', () => {
  it('adds page entries under deterministic type headings', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'mdnotes-index-updater-'));
    tempDirs.push(baseDir);
    const db = new Database(':memory:');
    dbs.push(db);
    initializeDatabase(db);

    for (const page of [
      { id: 'page-b', title: 'Zebra Source', slug: 'zebra-source', pageType: 'source-summary' as const, wikiPath: 'wiki/sources/zebra-source.md' },
      { id: 'page-a', title: 'Alpha Source', slug: 'alpha-source', pageType: 'source-summary' as const, wikiPath: 'wiki/sources/alpha-source.md' },
      { id: 'page-c', title: 'Concept One', slug: 'concept-one', pageType: 'concept' as const, wikiPath: 'wiki/concepts/concept-one.md' },
    ]) {
      saveWikiPage({
        db,
        userId: 'user-1',
        baseDir,
        markdown: `# ${page.title}`,
        record: {
          ...page,
          summary: '',
          backlinks: [],
          sourceIds: [],
          entityKeys: [],
          lastUpdatedAt: 1717286400000,
          lastUpdatedReason: 'ingest',
          confidence: 'medium',
          openQuestions: [],
        },
      });
    }

    const result = updateWikiIndex({ db, userId: 'user-1', baseDir });
    const vaultRoot = getUserVaultPaths('user-1', baseDir).root;
    const markdown = readVaultTextFile(vaultRoot, 'wiki/index.md');

    expect(result.record.wikiPath).toBe('wiki/index.md');
    expect(markdown).toContain('## Concepts');
    expect(markdown).toContain('## Source Summaries');
    expect(markdown.indexOf('[[concepts/concept-one|Concept One]]')).toBeLessThan(markdown.indexOf('[[sources/alpha-source|Alpha Source]]'));
    expect(markdown.indexOf('[[sources/alpha-source|Alpha Source]]')).toBeLessThan(markdown.indexOf('[[sources/zebra-source|Zebra Source]]'));
  });
});
