import { createRequire } from 'node:module';
import { join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { getDataDir } from './dataDir';

const require = createRequire(import.meta.url);
const BetterSqlite3 = require('better-sqlite3') as typeof import('better-sqlite3');
type SqliteDatabase = import('better-sqlite3').Database;

function ensureDataDir(dataDir: string): void {
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
}

export function initializeDatabase(db: SqliteDatabase): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      expiresAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT NOT NULL,
      userId TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      dateModified INTEGER NOT NULL DEFAULT 0,
      isPinned INTEGER NOT NULL DEFAULT 0,
      isShared INTEGER NOT NULL DEFAULT 0,
      folderId TEXT,
      version INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (userId, id)
    );

    CREATE TABLE IF NOT EXISTS folders (
      id TEXT NOT NULL,
      userId TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      parentFolderId TEXT,
      dateCreated INTEGER NOT NULL DEFAULT 0,
      dateModified INTEGER NOT NULL DEFAULT 0,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (userId, id)
    );

    CREATE TABLE IF NOT EXISTS raw_sources (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      sourceType TEXT NOT NULL,
      rawPath TEXT NOT NULL,
      importedAt INTEGER NOT NULL,
      sourceDate INTEGER,
      checksum TEXT,
      mimeType TEXT,
      status TEXT NOT NULL,
      summaryPageId TEXT,
      assetPathsJson TEXT NOT NULL DEFAULT '[]',
      tagsJson TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS wiki_pages (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      pageType TEXT NOT NULL,
      wikiPath TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      backlinksJson TEXT NOT NULL DEFAULT '[]',
      sourceIdsJson TEXT NOT NULL DEFAULT '[]',
      entityKeysJson TEXT NOT NULL DEFAULT '[]',
      lastUpdatedAt INTEGER NOT NULL,
      lastUpdatedReason TEXT NOT NULL,
      confidence TEXT,
      openQuestionsJson TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS wiki_mutations (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      runId TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      triggerType TEXT NOT NULL,
      sourceIdsJson TEXT NOT NULL DEFAULT '[]',
      changedPageIdsJson TEXT NOT NULL DEFAULT '[]',
      createdPageIdsJson TEXT NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS memory_chunks (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      noteId TEXT NOT NULL,
      title TEXT NOT NULL,
      chunkIndex INTEGER NOT NULL,
      chunkText TEXT NOT NULL,
      contentHash TEXT NOT NULL,
      embeddingJson TEXT NOT NULL,
      embeddingModel TEXT NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId);
    CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON sessions(expiresAt);
    CREATE INDEX IF NOT EXISTS idx_notes_userId ON notes(userId);
    CREATE INDEX IF NOT EXISTS idx_notes_folderId ON notes(userId, folderId);
    CREATE INDEX IF NOT EXISTS idx_notes_isShared ON notes(isShared);
    CREATE INDEX IF NOT EXISTS idx_folders_userId ON folders(userId);
    CREATE INDEX IF NOT EXISTS idx_raw_sources_userId ON raw_sources(userId);
    CREATE INDEX IF NOT EXISTS idx_raw_sources_slug ON raw_sources(userId, slug);
    CREATE INDEX IF NOT EXISTS idx_wiki_pages_userId ON wiki_pages(userId);
    CREATE INDEX IF NOT EXISTS idx_wiki_pages_pageType ON wiki_pages(userId, pageType);
    CREATE INDEX IF NOT EXISTS idx_wiki_pages_slug ON wiki_pages(userId, slug);
    CREATE INDEX IF NOT EXISTS idx_wiki_mutations_userId ON wiki_mutations(userId);
    CREATE INDEX IF NOT EXISTS idx_wiki_mutations_runId ON wiki_mutations(runId);
    CREATE INDEX IF NOT EXISTS idx_memory_chunks_user_note ON memory_chunks(userId, noteId);
    CREATE INDEX IF NOT EXISTS idx_memory_chunks_user ON memory_chunks(userId);
  `);

  try {
    db.exec(`ALTER TABLE notes ADD COLUMN summary TEXT`);
  } catch {
    // Column already exists — ignore
  }
}

let _db: SqliteDatabase | null = null;

export function getDb(): SqliteDatabase {
  if (_db) return _db;

  const dataDir = getDataDir();
  ensureDataDir(dataDir);
  _db = new BetterSqlite3(join(dataDir, 'app.db'));
  initializeDatabase(_db);

  return _db;
}
