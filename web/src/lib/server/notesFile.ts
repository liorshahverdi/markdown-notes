import { getDb } from './database';
import type { NoteRecord, FolderRecord } from '../../types/note';

// --- Row <-> Record helpers ---

interface NoteRow {
  id: string;
  userId: string;
  title: string;
  content: string;
  dateModified: number;
  isPinned: number;
  isShared: number;
  folderId: string | null;
  version: number;
  summary: string | null;
}

function rowToNote(row: NoteRow): NoteRecord & { version: number } {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    dateModified: row.dateModified,
    isPinned: row.isPinned === 1,
    isShared: row.isShared === 1,
    folderId: row.folderId,
    version: row.version,
    summary: row.summary,
  };
}

interface FolderRow {
  id: string;
  userId: string;
  name: string;
  parentFolderId: string | null;
  dateCreated: number;
  dateModified: number;
  sortOrder: number;
}

function rowToFolder(row: FolderRow): FolderRecord {
  return {
    id: row.id,
    name: row.name,
    parentFolderId: row.parentFolderId,
    dateCreated: row.dateCreated,
    dateModified: row.dateModified,
    sortOrder: row.sortOrder,
  };
}

// --- Notes ---

/** Read all notes for a user. */
export function readNotes(userId: string): NoteRecord[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM notes WHERE userId = ?').all(userId) as NoteRow[];
  return rows.map(rowToNote);
}

/** Write all notes for a user (replaces all). Used by migration and bulk ops. */
export function writeNotes(userId: string, notes: NoteRecord[]): void {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM notes WHERE userId = ?').run(userId);
    const insert = db.prepare(
      'INSERT INTO notes (id, userId, title, content, dateModified, isPinned, isShared, folderId, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const n of notes) {
      insert.run(
        n.id,
        userId,
        n.title,
        n.content,
        n.dateModified,
        n.isPinned ? 1 : 0,
        n.isShared ? 1 : 0,
        n.folderId ?? null,
        (n as any).version ?? 0
      );
    }
  });
  tx();
}

/** Get a single note by ID for a user. */
export function readNote(userId: string, id: string): NoteRecord | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM notes WHERE userId = ? AND id = ?').get(userId, id) as
    | NoteRow
    | undefined;
  return row ? rowToNote(row) : null;
}

/**
 * Upsert a single note for a user.
 * If expectedVersion is provided and the server note has a newer version,
 * returns 'conflict' with the server's version of the note.
 */
export function upsertNote(
  userId: string,
  note: NoteRecord,
  expectedVersion?: number
): { ok: true } | { ok: false; conflict: true; serverNote: NoteRecord } {
  const db = getDb();

  const existing = db.prepare('SELECT * FROM notes WHERE userId = ? AND id = ?').get(
    userId,
    note.id
  ) as NoteRow | undefined;

  if (existing && expectedVersion !== undefined) {
    if (existing.version > expectedVersion) {
      return { ok: false, conflict: true, serverNote: rowToNote(existing) };
    }
  }

  const newVersion = existing ? existing.version + 1 : ((note as any).version ?? 0) + 1;

  db.prepare(
    `INSERT INTO notes (id, userId, title, content, dateModified, isPinned, isShared, folderId, version, summary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(userId, id) DO UPDATE SET
       title = excluded.title,
       content = excluded.content,
       dateModified = excluded.dateModified,
       isPinned = excluded.isPinned,
       isShared = excluded.isShared,
       folderId = excluded.folderId,
       version = excluded.version`
  ).run(
    note.id,
    userId,
    note.title,
    note.content,
    note.dateModified,
    note.isPinned ? 1 : 0,
    note.isShared ? 1 : 0,
    note.folderId ?? null,
    newVersion,
    note.summary ?? null
  );

  return { ok: true };
}

/** Update only the summary field for a note. */
export function updateNoteSummary(userId: string, noteId: string, summary: string): void {
  const db = getDb();
  db.prepare('UPDATE notes SET summary = ? WHERE userId = ? AND id = ?').run(summary, userId, noteId);
}

/** Delete a single note for a user. */
export function deleteNote(userId: string, noteId: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM notes WHERE userId = ? AND id = ?').run(userId, noteId);
  return result.changes > 0;
}

// --- Folders ---

/** Read all folders for a user. */
export function readFolders(userId: string): FolderRecord[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM folders WHERE userId = ?').all(userId) as FolderRow[];
  return rows.map(rowToFolder);
}

/** Write all folders for a user (replaces all). Used by migration. */
export function writeFolders(userId: string, folders: FolderRecord[]): void {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM folders WHERE userId = ?').run(userId);
    const insert = db.prepare(
      'INSERT INTO folders (id, userId, name, parentFolderId, dateCreated, dateModified, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    for (const f of folders) {
      insert.run(f.id, userId, f.name, f.parentFolderId, f.dateCreated, f.dateModified, f.sortOrder);
    }
  });
  tx();
}

/** Upsert a single folder for a user. */
export function upsertFolder(userId: string, folder: FolderRecord): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO folders (id, userId, name, parentFolderId, dateCreated, dateModified, sortOrder)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(userId, id) DO UPDATE SET
       name = excluded.name,
       parentFolderId = excluded.parentFolderId,
       dateCreated = excluded.dateCreated,
       dateModified = excluded.dateModified,
       sortOrder = excluded.sortOrder`
  ).run(
    folder.id,
    userId,
    folder.name,
    folder.parentFolderId,
    folder.dateCreated,
    folder.dateModified,
    folder.sortOrder
  );
}

/** Delete a folder, re-parenting sub-folders and notes to the deleted folder's parent. */
export function deleteFolder(userId: string, folderId: string): boolean {
  const db = getDb();

  const target = db.prepare('SELECT * FROM folders WHERE userId = ? AND id = ?').get(
    userId,
    folderId
  ) as FolderRow | undefined;
  if (!target) return false;

  const newParent = target.parentFolderId;

  const tx = db.transaction(() => {
    // Re-parent sub-folders
    db.prepare('UPDATE folders SET parentFolderId = ? WHERE userId = ? AND parentFolderId = ?').run(
      newParent,
      userId,
      folderId
    );
    // Re-parent notes
    db.prepare('UPDATE notes SET folderId = ? WHERE userId = ? AND folderId = ?').run(
      newParent,
      userId,
      folderId
    );
    // Delete the folder
    db.prepare('DELETE FROM folders WHERE userId = ? AND id = ?').run(userId, folderId);
  });
  tx();

  return true;
}

/** Read all shared notes from all users except the given one. */
export function readSharedNotes(excludeUserId: string): NoteRecord[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT *, userId as ownerId FROM notes WHERE isShared = 1 AND userId != ?')
    .all(excludeUserId) as (NoteRow & { ownerId: string })[];
  return rows.map((row) => ({ ...rowToNote(row), ownerId: row.ownerId }));
}
