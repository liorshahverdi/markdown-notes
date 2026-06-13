// fake-indexeddb/auto is loaded via test-setup.ts (setupFiles in vitest config)
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';

import {
  notes,
  selectedNoteId,
  searchText,
  filteredNotes,
  selectedNote,
  updateNoteContent,
  hasPendingEdit,
  flushPendingSaves,
  clearPendingTimers,
  saveStatus,
  saveIssue,
  retryPendingSaves,
} from './notes';

describe('Notes Store', () => {
  beforeEach(() => {
    clearPendingTimers();
    notes.set([]);
    selectedNoteId.set(null);
    searchText.set('');
    saveStatus.set('saved');
    saveIssue.set(null);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
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

  describe('auto-save', () => {
    it('keeps a note pending when save fails so sync cannot overwrite it', async () => {
      vi.useFakeTimers();
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));
      notes.set([{ id: 'n1', title: 'N1', content: 'old', dateModified: 1, isPinned: false }]);

      updateNoteContent('n1', 'new content');
      expect(hasPendingEdit('n1')).toBe(true);

      await vi.advanceTimersByTimeAsync(1000);
      expect(hasPendingEdit('n1')).toBe(true);
      expect(get(notes)[0].content).toBe('new content');
    });

    it('flushes pending edits immediately', async () => {
      vi.useFakeTimers();
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, note: { id: 'n1', version: 2 } }), { status: 200 }));
      notes.set([{ id: 'n1', title: 'N1', content: 'old', dateModified: 1, isPinned: false }]);

      updateNoteContent('n1', 'saved content');
      await flushPendingSaves();

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock.mock.calls[0][1]?.body).toContain('saved content');
      expect(hasPendingEdit('n1')).toBe(false);
      expect(get(notes)[0].version).toBe(2);
      expect(get(saveStatus)).toBe('saved');
    });

    it('exposes conflict recovery details and lets the user retry pending saves', async () => {
      vi.useFakeTimers();
      const fetchMock = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(JSON.stringify({
          ok: false,
          conflict: true,
          serverNote: { id: 'n1', title: 'Server', content: 'server copy', dateModified: 2, isPinned: false, version: 3 }
        }), { status: 409 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          ok: true,
          note: { id: 'n1', title: 'N1', content: 'local copy', dateModified: 4, isPinned: false, version: 4 }
        }), { status: 200 }));

      notes.set([{ id: 'n1', title: 'N1', content: 'old', dateModified: 1, isPinned: false, version: 1 }]);
      updateNoteContent('n1', 'local copy');
      await vi.advanceTimersByTimeAsync(1000);

      expect(get(saveStatus)).toBe('conflict');
      expect(get(saveIssue)).toMatchObject({
        kind: 'conflict',
        noteId: 'n1',
        serverNote: { content: 'server copy', version: 3 },
      });
      expect(hasPendingEdit('n1')).toBe(true);

      await retryPendingSaves();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(get(saveStatus)).toBe('saved');
      expect(get(saveIssue)).toBeNull();
      expect(get(notes)[0].version).toBe(4);
    });
  });
});
