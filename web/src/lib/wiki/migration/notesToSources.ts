import type Database from 'better-sqlite3';
import type { NoteRecord } from '../../../types/note';
import type { RawSourceRecord } from '$lib/wiki/types';
import { importSourceText } from '$lib/wiki/ingest/sourceImporter';

export interface NoteSourceImportInput {
  title: string;
  content: string;
  sourceType: RawSourceRecord['sourceType'];
  sourceDate: number | null;
  tags: string[];
}

export interface MigrateNotesToSourcesInput {
  db: Database.Database;
  userId: string;
  baseDir: string;
}

export interface MigrateNotesToSourcesResult {
  totalNotes: number;
  migrated: number;
  skipped: number;
  sourceIds: string[];
}

interface NoteRow {
  id: string;
  title: string;
  content: string;
  dateModified: number;
  isPinned: number;
  isShared: number;
  folderId: string | null;
  summary: string | null;
}

function rowToNote(row: NoteRow): NoteRecord {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    dateModified: row.dateModified,
    isPinned: row.isPinned === 1,
    isShared: row.isShared === 1,
    folderId: row.folderId,
    summary: row.summary,
  };
}

function legacyNoteTag(noteId: string): string {
  return `legacy-note:${noteId}`;
}

function readNotes(db: Database.Database, userId: string): NoteRecord[] {
  return (db
    .prepare('SELECT id, title, content, dateModified, isPinned, isShared, folderId, summary FROM notes WHERE userId = ? ORDER BY dateModified DESC')
    .all(userId) as NoteRow[]).map(rowToNote);
}

function parseTags(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function readMigratedLegacyTags(db: Database.Database, userId: string): Set<string> {
  const rows = db.prepare('SELECT tagsJson FROM raw_sources WHERE userId = ? AND sourceType = ?').all(userId, 'note') as Array<{ tagsJson: string }>;
  return new Set(rows.flatMap((row) => parseTags(row.tagsJson)).filter((tag) => tag.startsWith('legacy-note:')));
}

export function adaptNoteToSourceImport(note: NoteRecord): NoteSourceImportInput {
  const tags = ['legacy-note', legacyNoteTag(note.id)];
  if (note.folderId) tags.push(`folder:${note.folderId}`);
  if (note.isPinned) tags.push('pinned');
  if (note.isShared) tags.push('shared');

  return {
    title: note.title,
    content: note.content,
    sourceType: 'note',
    sourceDate: note.dateModified ?? null,
    tags,
  };
}

export function migrateNotesToSources(input: MigrateNotesToSourcesInput): MigrateNotesToSourcesResult {
  const notes = readNotes(input.db, input.userId);
  const alreadyMigrated = readMigratedLegacyTags(input.db, input.userId);
  const sourceIds: string[] = [];
  let skipped = 0;

  for (const note of notes) {
    const tag = legacyNoteTag(note.id);
    if (alreadyMigrated.has(tag)) {
      skipped += 1;
      continue;
    }

    const source = adaptNoteToSourceImport(note);
    const result = importSourceText({
      db: input.db,
      userId: input.userId,
      baseDir: input.baseDir,
      title: source.title,
      content: source.content,
      sourceType: source.sourceType,
      sourceDate: source.sourceDate,
      tags: source.tags,
    });
    sourceIds.push(result.record.id);
    alreadyMigrated.add(tag);
  }

  return {
    totalNotes: notes.length,
    migrated: sourceIds.length,
    skipped,
    sourceIds,
  };
}
