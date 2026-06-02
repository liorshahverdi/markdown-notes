import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db, MarkdownNotesDB } from './index';
import type { NoteRecord } from '../../types/note';

describe('MarkdownNotesDB', () => {
  beforeEach(async () => {
    // Clear all tables before each test
    if (db.isOpen()) {
      await db.delete();
    }
    await db.open();
  });

  describe('database setup', () => {
    it('should be an instance of MarkdownNotesDB', () => {
      expect(db).toBeInstanceOf(MarkdownNotesDB);
    });

    it('should have database name "markdownnotes"', () => {
      expect(db.name).toBe('markdownnotes');
    });

    it('should be at version 7', () => {
      expect(db.verno).toBe(7);
    });
  });

  describe('tables exist', () => {
    it('should have a notes table', () => {
      expect(db.table('notes')).toBeDefined();
    });

    it('should have an embeddings table', () => {
      expect(db.table('embeddings')).toBeDefined();
    });

    it('should have an entities table', () => {
      expect(db.table('entities')).toBeDefined();
    });

    it('should have a relations table', () => {
      expect(db.table('relations')).toBeDefined();
    });

    it('should have an improvements table', () => {
      expect(db.table('improvements')).toBeDefined();
    });

    it('should have a skills table', () => {
      expect(db.table('skills')).toBeDefined();
    });

    it('should have a folders table', () => {
      expect(db.table('folders')).toBeDefined();
    });
  });

  describe('notes table indexes', () => {
    it('should have id as primary key', async () => {
      const note: NoteRecord = {
        id: 'test-id-1',
        title: 'Test Note',
        content: '# Test Note\n\n',
        dateModified: Date.now(),
        isPinned: false,
      };
      await db.table('notes').put(note);
      const retrieved = await db.table('notes').get('test-id-1');
      expect(retrieved).toEqual(note);
    });

    it('should support querying by dateModified index', async () => {
      const now = Date.now();
      await db.table('notes').bulkPut([
        { id: 'a', title: 'A', content: '', dateModified: now - 1000, isPinned: false },
        { id: 'b', title: 'B', content: '', dateModified: now, isPinned: false },
      ]);
      const results = await db.table('notes').where('dateModified').above(now - 500).toArray();
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('b');
    });

    it('should have isPinned as an indexed field', () => {
      const schema = db.table('notes').schema;
      const indexNames = schema.indexes.map((idx: any) => idx.name);
      expect(indexNames).toContain('isPinned');
    });
  });

  describe('CRUD operations on notes', () => {
    it('should add and retrieve a note', async () => {
      const note: NoteRecord = {
        id: 'crud-1',
        title: 'CRUD Test',
        content: '# CRUD Test\n\n',
        dateModified: Date.now(),
        isPinned: false,
      };
      await db.table('notes').put(note);
      const result = await db.table('notes').get('crud-1');
      expect(result).toEqual(note);
    });

    it('should update a note', async () => {
      await db.table('notes').put({
        id: 'crud-2',
        title: 'Original',
        content: '# Original\n\n',
        dateModified: 1000,
        isPinned: false,
      });
      await db.table('notes').update('crud-2', { title: 'Updated', dateModified: 2000 });
      const result = await db.table('notes').get('crud-2');
      expect(result?.title).toBe('Updated');
      expect(result?.dateModified).toBe(2000);
    });

    it('should delete a note', async () => {
      await db.table('notes').put({
        id: 'crud-3',
        title: 'Delete Me',
        content: '',
        dateModified: 1000,
        isPinned: false,
      });
      await db.table('notes').delete('crud-3');
      const result = await db.table('notes').get('crud-3');
      expect(result).toBeUndefined();
    });
  });
});
