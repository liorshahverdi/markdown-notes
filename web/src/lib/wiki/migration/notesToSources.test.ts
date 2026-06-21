import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeDatabase } from '$lib/server/database';
import type { NoteRecord } from '../../../types/note';
import { adaptNoteToSourceImport, migrateNotesToSources, syncNoteToSource } from './notesToSources';

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
  const baseDir = mkdtempSync(join(tmpdir(), 'mdnotes-note-migration-'));
  tempDirs.push(baseDir);
  const db = new Database(':memory:');
  dbs.push(db);
  initializeDatabase(db);
  return { db, baseDir };
}

function note(overrides: Partial<NoteRecord> = {}): NoteRecord {
  return {
    id: 'note-1',
    title: 'Ada Research Note',
    content: '# Ada Research Note\n\nAda Lovelace studied the Analytical Engine.',
    dateModified: Date.UTC(2026, 0, 2),
    isPinned: false,
    isShared: false,
    folderId: 'folder-1',
    summary: 'Short summary',
    ...overrides,
  };
}

function insertNote(db: Database.Database, userId: string, record: NoteRecord) {
  db.prepare('INSERT INTO notes (id, userId, title, content, dateModified, isPinned, isShared, folderId, version, summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(record.id, userId, record.title, record.content, record.dateModified, record.isPinned ? 1 : 0, record.isShared ? 1 : 0, record.folderId ?? null, 0, record.summary ?? null);
}

describe('adaptNoteToSourceImport', () => {
  it('maps a legacy note to a note raw-source import without changing note content', () => {
    const input = adaptNoteToSourceImport(note());

    expect(input).toEqual({
      title: 'Ada Research Note',
      content: '# Ada Research Note\n\nAda Lovelace studied the Analytical Engine.',
      sourceType: 'note',
      sourceDate: Date.UTC(2026, 0, 2),
      tags: ['legacy-note', 'legacy-note:note-1', 'folder:folder-1'],
    });
  });
});

describe('syncNoteToSource', () => {
  it('explicitly mirrors a selected note into an ingested raw source and wiki page', () => {
    const { db, baseDir } = setup();
    const savedNote = note({
      id: 'note-autosync',
      title: 'Cobalt Finch Field Report',
      content: '# Cobalt Finch Field Report\n\nThe cobalt finch nested at Pier 17 and carried a brass tag labeled CF-22.',
    });

    const result = syncNoteToSource({ db, userId: 'user-1', baseDir, note: savedNote });

    const rawSources = db.prepare('SELECT id, title, rawPath, tagsJson, status, summaryPageId FROM raw_sources WHERE userId = ?').all('user-1') as Array<{ id: string; title: string; rawPath: string; tagsJson: string; status: string; summaryPageId: string | null }>;
    const wikiPages = db.prepare('SELECT title, pageType, sourceIdsJson FROM wiki_pages WHERE userId = ? AND pageType = ?').all('user-1', 'source-summary') as Array<{ title: string; pageType: string; sourceIdsJson: string }>;

    expect(result.record.status).toBe('ingested');
    expect(rawSources).toHaveLength(1);
    expect(rawSources[0]).toEqual(expect.objectContaining({ title: 'Cobalt Finch Field Report', status: 'ingested' }));
    expect(JSON.parse(rawSources[0].tagsJson)).toEqual(expect.arrayContaining(['legacy-note:note-autosync']));
    expect(readFileSync(join(baseDir, 'vaults', 'user-1', rawSources[0].rawPath), 'utf-8')).toContain('brass tag labeled CF-22');
    expect(wikiPages).toHaveLength(1);
    expect(JSON.parse(wikiPages[0].sourceIdsJson)).toEqual([rawSources[0].id]);
  });
});

describe('migrateNotesToSources', () => {
  it('imports legacy notes as raw sources/wiki pages without deleting notes and skips already-migrated notes', () => {
    const { db, baseDir } = setup();
    insertNote(db, 'user-1', note());

    const first = migrateNotesToSources({ db, userId: 'user-1', baseDir });
    const second = migrateNotesToSources({ db, userId: 'user-1', baseDir });

    expect(first).toEqual(expect.objectContaining({ migrated: 1, skipped: 0, totalNotes: 1 }));
    expect(second).toEqual(expect.objectContaining({ migrated: 0, skipped: 1, totalNotes: 1 }));

    const noteCount = db.prepare('SELECT COUNT(*) AS count FROM notes WHERE userId = ?').get('user-1') as { count: number };
    const rawSources = db.prepare('SELECT id, title, sourceType, rawPath, tagsJson, status, summaryPageId FROM raw_sources WHERE userId = ?').all('user-1') as Array<{ id: string; title: string; sourceType: string; rawPath: string; tagsJson: string; status: string; summaryPageId: string | null }>;

    expect(noteCount.count).toBe(1);
    expect(rawSources).toHaveLength(1);
    expect(rawSources[0]).toEqual(expect.objectContaining({ title: 'Ada Research Note', sourceType: 'note', status: 'ingested' }));
    expect(JSON.parse(rawSources[0].tagsJson)).toEqual(expect.arrayContaining(['legacy-note:note-1']));
    expect(rawSources[0].summaryPageId).toBeTypeOf('string');
    expect(readFileSync(join(baseDir, 'vaults', 'user-1', rawSources[0].rawPath), 'utf-8')).toBe(note().content);
  });
});
