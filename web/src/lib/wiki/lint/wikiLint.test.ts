import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeDatabase } from '$lib/server/database';
import { ensureUserVaultDirectories } from '$lib/server/vaultPaths';
import { saveWikiPage } from '$lib/wiki/wikiPageRepository';
import type { WikiPageRecord } from '$lib/wiki/types';
import { runWikiLint } from './wikiLint';

const tempDirs: string[] = [];
const dbs: Database.Database[] = [];

afterEach(() => {
  while (dbs.length > 0) dbs.pop()?.close();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function setup() {
  const baseDir = mkdtempSync(join(tmpdir(), 'mdnotes-wiki-lint-'));
  tempDirs.push(baseDir);
  const db = new Database(':memory:');
  dbs.push(db);
  initializeDatabase(db);
  ensureUserVaultDirectories('user-1', baseDir);
  return { db, baseDir };
}

function page(overrides: Partial<WikiPageRecord>): WikiPageRecord {
  return {
    id: 'entity-ada',
    title: 'Ada Lovelace',
    slug: 'ada-lovelace',
    pageType: 'entity',
    wikiPath: 'wiki/entities/ada-lovelace.md',
    summary: 'Ada summary',
    backlinks: [],
    sourceIds: [],
    entityKeys: [],
    lastUpdatedAt: Date.now(),
    lastUpdatedReason: 'ingest',
    confidence: 'medium',
    openQuestions: [],
    ...overrides,
  };
}

describe('runWikiLint', () => {
  it('aggregates actionable wiki health findings from DB pages and vault markdown', () => {
    const { db, baseDir } = setup();
    saveWikiPage({
      db,
      userId: 'user-1',
      baseDir,
      record: page({ id: 'entity-ada' }),
      markdown: '# Ada\n\nSee [[concepts/missing|Missing]].\n\nClaim: programmer = true',
    });
    saveWikiPage({
      db,
      userId: 'user-1',
      baseDir,
      record: page({
        id: 'concept-history',
        title: 'History',
        slug: 'history',
        pageType: 'concept',
        wikiPath: 'wiki/concepts/history.md',
        backlinks: ['entity-ada'],
      }),
      markdown: '# History\n\nClaim: programmer = false',
    });

    const result = runWikiLint({ db, userId: 'user-1', baseDir, now: Date.now() });

    expect(result.summary.total).toBeGreaterThanOrEqual(3);
    expect(result.findings.map((finding) => finding.type)).toEqual(expect.arrayContaining(['orphan-page', 'broken-link', 'contradiction']));
    expect(result.findings.every((finding) => finding.action.length > 0)).toBe(true);
  });
});
