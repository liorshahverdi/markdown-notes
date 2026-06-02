import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeDatabase } from '$lib/server/database';
import { ensureUserVaultDirectories } from '$lib/server/vaultPaths';
import { fileAnswerToWiki } from './fileAnswerWorkflow';

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
  const baseDir = mkdtempSync(join(tmpdir(), 'mdnotes-file-answer-'));
  tempDirs.push(baseDir);
  const db = new Database(':memory:');
  dbs.push(db);
  initializeDatabase(db);
  ensureUserVaultDirectories('user-1', baseDir);
  return { db, baseDir };
}

describe('fileAnswerToWiki', () => {
  it('saves a useful answer as a question page, updates index/log, and records mutation', () => {
    const { db, baseDir } = setup();

    const result = fileAnswerToWiki({
      db,
      userId: 'user-1',
      baseDir,
      question: 'What did Ada contribute?',
      answer: 'Ada described symbolic operations for the Analytical Engine. [wiki-page:entity-ada]',
      citations: [{ id: 'entity-ada', title: 'Ada Lovelace', kind: 'wiki-page', wikiPath: 'wiki/entities/ada-lovelace.md', relevanceScore: 1 }],
      coverage: 'strong',
      usedRawFallback: false,
    });

    expect(result.status).toBe('filed');
    expect(result.pageId).toBe('question-what-did-ada-contribute');
    const vaultRoot = join(baseDir, 'vaults', 'user-1');
    expect(readFileSync(join(vaultRoot, 'wiki/questions/what-did-ada-contribute.md'), 'utf-8')).toContain('Ada described symbolic operations');
    expect(readFileSync(join(vaultRoot, 'wiki/index.md'), 'utf-8')).toContain('[[questions/what-did-ada-contribute|What did Ada contribute?]]');
    expect(readFileSync(join(vaultRoot, 'wiki/log.md'), 'utf-8')).toContain('query: Filed answer to wiki page question-what-did-ada-contribute');
  });

  it('returns skipped and does not create a page for non-useful answers', () => {
    const { db, baseDir } = setup();

    const result = fileAnswerToWiki({
      db,
      userId: 'user-1',
      baseDir,
      question: 'What is missing?',
      answer: 'I do not have enough information to answer that.',
      citations: [],
      coverage: 'weak',
      usedRawFallback: false,
    });

    expect(result.status).toBe('skipped');
    expect(db.prepare('SELECT COUNT(*) AS count FROM wiki_pages WHERE pageType = ?').get('question')).toEqual({ count: 0 });
  });
});
