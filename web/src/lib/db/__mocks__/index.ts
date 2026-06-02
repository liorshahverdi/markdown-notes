import Dexie from 'dexie';
import type { NoteRecord } from '../../../types/note';

export class MarkdownNotesDB extends Dexie {
  notes!: Dexie.Table<NoteRecord, string>;

  constructor() {
    super('markdownnotes-mock');
    this.version(1).stores({
      notes: 'id, title, dateModified, isPinned',
    });
  }
}

export const db = new MarkdownNotesDB();
