import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeDatabase } from '$lib/server/database';
import { writeVaultTextFile } from '$lib/server/vaultFs';
import { ensureUserVaultDirectories } from '$lib/server/vaultPaths';
import { buildWikiFirstQueryContext } from './queryPipeline';

const tempDirs: string[] = [];
const dbs: Database.Database[] = [];

afterEach(() => {
  while (dbs.length > 0) dbs.pop()?.close();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('buildWikiFirstQueryContext', () => {
  it('returns wiki-first messages plus citation metadata for API responses', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'mdnotes-query-pipeline-'));
    tempDirs.push(baseDir);
    const db = new Database(':memory:');
    dbs.push(db);
    initializeDatabase(db);
    ensureUserVaultDirectories('user-1', baseDir);
    writeVaultTextFile(join(baseDir, 'vaults', 'user-1'), 'wiki/entities/deep-signal.md', '# Deep Signal\n\nSonar game facts.');
    db.prepare(`
      INSERT INTO wiki_pages (id, userId, title, slug, pageType, wikiPath, summary, backlinksJson, sourceIdsJson, entityKeysJson, lastUpdatedAt, lastUpdatedReason, confidence, openQuestionsJson)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('entity-deep-signal', 'user-1', 'Deep Signal', 'deep-signal', 'entity', 'wiki/entities/deep-signal.md', 'Sonar game facts.', '[]', '["source-1"]', '["entity:deep-signal"]', Date.now(), 'ingest', 'medium', '[]');

    const context = buildWikiFirstQueryContext({ db, userId: 'user-1', baseDir, query: 'deep signal sonar', topK: 3 });

    expect(context.coverage).toBe('strong');
    expect(context.usedRawFallback).toBe(false);
    expect(context.citations).toEqual([{ id: 'entity-deep-signal', title: 'Deep Signal', kind: 'wiki-page', wikiPath: 'wiki/entities/deep-signal.md', relevanceScore: 1 }]);
    expect(context.messages[1].content).toContain('[wiki-page:entity-deep-signal]');
  });
});
