import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeDatabase } from '$lib/server/database';
import { writeVaultTextFile } from '$lib/server/vaultFs';
import { ensureUserVaultDirectories } from '$lib/server/vaultPaths';
import { searchWikiFirst } from './wikiSearch';

const tempDirs: string[] = [];
const dbs: Database.Database[] = [];

afterEach(() => {
  while (dbs.length > 0) dbs.pop()?.close();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function setupDb() {
  const baseDir = mkdtempSync(join(tmpdir(), 'mdnotes-wiki-search-'));
  tempDirs.push(baseDir);
  const db = new Database(':memory:');
  dbs.push(db);
  initializeDatabase(db);
  ensureUserVaultDirectories('user-1', baseDir);
  return { db, baseDir };
}

function insertWikiPage(db: Database.Database, overrides: Partial<Record<string, unknown>>) {
  db.prepare(`
    INSERT INTO wiki_pages (
      id, userId, title, slug, pageType, wikiPath, summary,
      backlinksJson, sourceIdsJson, entityKeysJson, lastUpdatedAt, lastUpdatedReason, confidence, openQuestionsJson
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    overrides.id ?? 'page-1', 'user-1', overrides.title ?? 'Ada Lovelace', overrides.slug ?? 'ada-lovelace',
    overrides.pageType ?? 'entity', overrides.wikiPath ?? 'wiki/entities/ada-lovelace.md',
    overrides.summary ?? 'Ada worked on computing.', '[]', JSON.stringify(overrides.sourceIds ?? ['source-1']),
    JSON.stringify(overrides.entityKeys ?? ['person:ada-lovelace']), Date.now(), 'ingest', 'medium', '[]'
  );
}

describe('searchWikiFirst', () => {
  it('prioritizes page title and slug matches before raw-source fallback', () => {
    const { db, baseDir } = setupDb();
    writeVaultTextFile(join(baseDir, 'vaults', 'user-1'), 'wiki/entities/ada-lovelace.md', '# Ada Lovelace\n\n## Summary\nFirst programmer.');
    insertWikiPage(db, { id: 'entity-ada', title: 'Ada Lovelace', slug: 'ada-lovelace' });

    const result = searchWikiFirst({ db, userId: 'user-1', baseDir, query: 'ada lovelace', topK: 3 });

    expect(result.coverage).toBe('strong');
    expect(result.usedRawFallback).toBe(false);
    expect(result.results[0]).toMatchObject({ id: 'entity-ada', title: 'Ada Lovelace', sourceKind: 'wiki-page' });
  });

  it('matches semantic wiki chunks from summary and markdown body text', () => {
    const { db, baseDir } = setupDb();
    writeVaultTextFile(join(baseDir, 'vaults', 'user-1'), 'wiki/concepts/symbolic-programming.md', '# symbolic programming\n\nSymbol manipulation in programs.');
    insertWikiPage(db, {
      id: 'concept-symbolic',
      title: 'symbolic programming',
      slug: 'symbolic-programming',
      pageType: 'concept',
      wikiPath: 'wiki/concepts/symbolic-programming.md',
      summary: 'Programs manipulate symbols and abstractions.',
      entityKeys: ['concept:symbolic-programming'],
    });

    const result = searchWikiFirst({ db, userId: 'user-1', baseDir, query: 'symbol manipulation abstractions', topK: 3 });

    expect(result.coverage).toBe('strong');
    expect(result.results[0].id).toBe('concept-symbolic');
    expect(result.results[0].excerpt).toContain('Symbol');
  });

  it('uses raw-source fallback only when wiki coverage is weak', () => {
    const { db, baseDir } = setupDb();
    const vaultRoot = join(baseDir, 'vaults', 'user-1');
    writeVaultTextFile(vaultRoot, 'raw/2026/deep-signal.md', 'Deep Signal uses sonar pulses and ship placement.');
    db.prepare(`
      INSERT INTO raw_sources (id, userId, title, slug, sourceType, rawPath, importedAt, status, assetPathsJson, tagsJson)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('source-1', 'user-1', 'Deep Signal Notes', 'deep-signal-notes', 'note', 'raw/2026/deep-signal.md', Date.now(), 'ingested', '[]', '[]');

    const result = searchWikiFirst({ db, userId: 'user-1', baseDir, query: 'sonar pulses', topK: 3 });

    expect(result.coverage).toBe('weak');
    expect(result.usedRawFallback).toBe(true);
    expect(result.results[0]).toMatchObject({ id: 'source-1', sourceKind: 'raw-source' });
  });
});
