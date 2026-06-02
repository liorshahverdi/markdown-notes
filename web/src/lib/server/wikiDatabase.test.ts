import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeDatabase } from './database';

const dbs: Database.Database[] = [];

afterEach(() => {
  while (dbs.length > 0) {
    dbs.pop()?.close();
  }
});

describe('initializeDatabase', () => {
  it('creates raw_sources, wiki_pages, and wiki_mutations tables', () => {
    const db = new Database(':memory:');
    dbs.push(db);

    initializeDatabase(db);

    const tables = (db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>)
      .map((row) => row.name);

    expect(tables).toEqual(
      expect.arrayContaining(['raw_sources', 'wiki_pages', 'wiki_mutations'])
    );
  });

  it('creates indexes for the new wiki tables', () => {
    const db = new Database(':memory:');
    dbs.push(db);

    initializeDatabase(db);

    const indexes = (db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
      .all() as Array<{ name: string }>)
      .map((row) => row.name);

    expect(indexes).toEqual(
      expect.arrayContaining([
        'idx_raw_sources_userId',
        'idx_wiki_pages_userId',
        'idx_wiki_pages_pageType',
        'idx_wiki_mutations_userId',
      ])
    );
  });
});
