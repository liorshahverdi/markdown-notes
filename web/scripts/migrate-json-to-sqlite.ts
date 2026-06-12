/**
 * Migration script: reads existing JSON data files and inserts them into SQLite.
 * Run with: npx tsx scripts/migrate-json-to-sqlite.ts
 *
 * Safe to run multiple times — uses INSERT OR REPLACE.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import Database from 'better-sqlite3';

const DATA_DIR = resolve(process.cwd(), process.env.MARKDOWN_NOTES_DATA_DIR?.trim() || 'data');
const NOTES_DIR = join(DATA_DIR, 'notes');
const FOLDERS_DIR = join(DATA_DIR, 'folders');
const USERS_FILE = join(DATA_DIR, 'users.json');
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json');
const DB_PATH = join(DATA_DIR, 'app.db');

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    console.warn(`  Skipping corrupt file: ${path}`);
    return null;
  }
}

function main() {
  console.log('=== JSON → SQLite Migration ===\n');

  // Open/create database
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables (same as database.ts)
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
      expiresAt INTEGER NOT NULL
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
    CREATE INDEX IF NOT EXISTS idx_notes_userId ON notes(userId);
    CREATE INDEX IF NOT EXISTS idx_notes_isShared ON notes(isShared);
    CREATE INDEX IF NOT EXISTS idx_folders_userId ON folders(userId);
  `);

  // 1. Migrate users
  const users = readJson<Array<{ id: string; username: string; passwordHash: string; createdAt: number }>>(USERS_FILE);
  if (users && users.length > 0) {
    const stmt = db.prepare(
      'INSERT OR REPLACE INTO users (id, username, passwordHash, createdAt) VALUES (?, ?, ?, ?)'
    );
    const tx = db.transaction(() => {
      for (const u of users) {
        stmt.run(u.id, u.username, u.passwordHash, u.createdAt);
      }
    });
    tx();
    console.log(`Users: migrated ${users.length}`);
  } else {
    console.log('Users: no data to migrate');
  }

  // 2. Migrate sessions
  const sessions = readJson<Array<{ token: string; userId: string; expiresAt: number }>>(SESSIONS_FILE);
  if (sessions && sessions.length > 0) {
    const now = Date.now();
    const valid = sessions.filter((s) => s.expiresAt > now);
    const stmt = db.prepare(
      'INSERT OR REPLACE INTO sessions (token, userId, expiresAt) VALUES (?, ?, ?)'
    );
    const tx = db.transaction(() => {
      for (const s of valid) {
        stmt.run(s.token, s.userId, s.expiresAt);
      }
    });
    tx();
    console.log(`Sessions: migrated ${valid.length} (skipped ${sessions.length - valid.length} expired)`);
  } else {
    console.log('Sessions: no data to migrate');
  }

  // 3. Migrate notes (per-user JSON files)
  if (existsSync(NOTES_DIR)) {
    const files = readdirSync(NOTES_DIR).filter((f) => f.endsWith('.json'));
    let totalNotes = 0;
    const stmt = db.prepare(
      'INSERT OR REPLACE INTO notes (id, userId, title, content, dateModified, isPinned, isShared, folderId, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const tx = db.transaction(() => {
      for (const file of files) {
        const userId = file.replace('.json', '');
        const notes = readJson<any[]>(join(NOTES_DIR, file));
        if (!notes) continue;
        for (const n of notes) {
          stmt.run(
            n.id,
            userId,
            n.title ?? '',
            n.content ?? '',
            n.dateModified ?? 0,
            n.isPinned ? 1 : 0,
            n.isShared ? 1 : 0,
            n.folderId ?? null,
            n.version ?? 0
          );
          totalNotes++;
        }
      }
    });
    tx();
    console.log(`Notes: migrated ${totalNotes} across ${files.length} user file(s)`);
  } else {
    console.log('Notes: no data directory found');
  }

  // 4. Migrate folders (per-user JSON files)
  if (existsSync(FOLDERS_DIR)) {
    const files = readdirSync(FOLDERS_DIR).filter((f) => f.endsWith('.json'));
    let totalFolders = 0;
    const stmt = db.prepare(
      'INSERT OR REPLACE INTO folders (id, userId, name, parentFolderId, dateCreated, dateModified, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const tx = db.transaction(() => {
      for (const file of files) {
        const userId = file.replace('.json', '');
        const folders = readJson<any[]>(join(FOLDERS_DIR, file));
        if (!folders) continue;
        for (const f of folders) {
          stmt.run(
            f.id,
            userId,
            f.name ?? '',
            f.parentFolderId ?? null,
            f.dateCreated ?? 0,
            f.dateModified ?? 0,
            f.sortOrder ?? 0
          );
          totalFolders++;
        }
      }
    });
    tx();
    console.log(`Folders: migrated ${totalFolders} across ${files.length} user file(s)`);
  } else {
    console.log('Folders: no data directory found');
  }

  db.close();
  console.log('\nMigration complete! Database at:', DB_PATH);
  console.log('You can safely keep the JSON files as backups.');
}

main();
