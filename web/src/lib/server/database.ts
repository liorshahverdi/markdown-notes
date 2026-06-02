import Database from 'better-sqlite3';
import { join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';

const DATA_DIR = join(process.cwd(), 'data');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  ensureDataDir();
  _db = new Database(join(DATA_DIR, 'app.db'));

  // Enable WAL mode for better concurrent read performance
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  // Create tables
  _db.exec(`
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

    CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId);
    CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON sessions(expiresAt);
    CREATE INDEX IF NOT EXISTS idx_notes_userId ON notes(userId);
    CREATE INDEX IF NOT EXISTS idx_notes_folderId ON notes(userId, folderId);
    CREATE INDEX IF NOT EXISTS idx_notes_isShared ON notes(isShared);
    CREATE INDEX IF NOT EXISTS idx_folders_userId ON folders(userId);
  `);

  // Add summary column if it doesn't exist (migration for existing DBs)
  try {
    _db.exec(`ALTER TABLE notes ADD COLUMN summary TEXT`);
  } catch {
    // Column already exists — ignore
  }

  return _db;
}
