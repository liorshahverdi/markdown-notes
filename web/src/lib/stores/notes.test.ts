// fake-indexeddb/auto is loaded via test-setup.ts (setupFiles in vitest config)
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';

import {
  notes,
  selectedNoteId,
  searchText,
  filteredNotes,
  selectedNote,
} from './notes';

describe('Notes Store', () => {
  beforeEach(() => {
    notes.set([]);
    selectedNoteId.set(null);
    searchText.set('');
  });

  describe('filteredNotes', () => {
    it('should sort pinned notes first, then by dateModified desc', () => {
      const now = Date.now();
      notes.set([
        { id: 'a', title: 'A', content: '', dateModified: now - 2000, isPinned: false },
        { id: 'b', title: 'B', content: '', dateModified: now - 1000, isPinned: true },
        { id: 'c', title: 'C', content: '', dateModified: now, isPinned: false },
      ]);

      const result = get(filteredNotes);
      expect(result[0].id).toBe('b');
      expect(result[1].id).toBe('c');
      expect(result[2].id).toBe('a');
    });

    it('should sort multiple pinned notes by dateModified desc', () => {
      const now = Date.now();
      notes.set([
        { id: 'a', title: 'A', content: '', dateModified: now - 1000, isPinned: true },
        { id: 'b', title: 'B', content: '', dateModified: now, isPinned: true },
        { id: 'c', title: 'C', content: '', dateModified: now - 500, isPinned: false },
      ]);

      const result = get(filteredNotes);
      expect(result[0].id).toBe('b');
      expect(result[1].id).toBe('a');
      expect(result[2].id).toBe('c');
    });

    it('should filter by title case-insensitively when searchText is set', () => {
      notes.set([
        { id: 'a', title: 'Shopping List', content: '', dateModified: 1, isPinned: false },
        { id: 'b', title: 'Meeting Notes', content: '', dateModified: 2, isPinned: false },
        { id: 'c', title: 'Recipe Ideas', content: '', dateModified: 3, isPinned: false },
      ]);

      searchText.set('meeting');

      const result = get(filteredNotes);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('b');
    });

    it('should filter by content case-insensitively when searchText is set', () => {
      notes.set([
        { id: 'a', title: 'Note A', content: 'Buy groceries', dateModified: 1, isPinned: false },
        { id: 'b', title: 'Note B', content: 'Fix the bug', dateModified: 2, isPinned: false },
      ]);

      searchText.set('groceries');

      const result = get(filteredNotes);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a');
    });

    it('should return all notes when searchText is empty', () => {
      notes.set([
        { id: 'a', title: 'A', content: '', dateModified: 1, isPinned: false },
        { id: 'b', title: 'B', content: '', dateModified: 2, isPinned: false },
      ]);

      searchText.set('');

      expect(get(filteredNotes)).toHaveLength(2);
    });
  });

  describe('selectedNote', () => {
    it('should return the note matching selectedNoteId', () => {
      notes.set([
        { id: 'x', title: 'X', content: '', dateModified: 1, isPinned: false },
        { id: 'y', title: 'Y', content: '', dateModified: 2, isPinned: false },
      ]);
      selectedNoteId.set('y');

      expect(get(selectedNote)?.id).toBe('y');
    });

    it('should return null when selectedNoteId is null', () => {
      notes.set([
        { id: 'x', title: 'X', content: '', dateModified: 1, isPinned: false },
      ]);
      selectedNoteId.set(null);

      expect(get(selectedNote)).toBeNull();
    });
  });
});
