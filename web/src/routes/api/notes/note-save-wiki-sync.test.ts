import { describe, expect, it, vi } from 'vitest';
import type { NoteRecord } from '../../../types/note';

const savedNote: NoteRecord = {
  id: 'note-1',
  title: 'Default Note Save',
  content: '# Default Note Save\n\nThis should stay in the notes vault only.',
  dateModified: 1,
  isPinned: false,
  isShared: false,
};

async function loadRouteWithMocks() {
  vi.resetModules();

  const syncNoteToSource = vi.fn();
  const triggerSummaryGeneration = vi.fn();
  const indexNoteMemory = vi.fn().mockResolvedValue(undefined);

  vi.doMock('$lib/server/notesFile', () => ({
    readNotes: vi.fn(() => [savedNote]),
    readNote: vi.fn(() => ({ ...savedNote, version: 1 })),
    upsertNote: vi.fn(() => ({ ok: true })),
    deleteNote: vi.fn(() => true),
  }));
  vi.doMock('$lib/server/noteSummarizer', () => ({ triggerSummaryGeneration }));
  vi.doMock('$lib/memory/localMemoryIndex', () => ({
    indexNoteMemory,
    deleteNoteMemory: vi.fn(),
  }));
  vi.doMock('$lib/wiki/migration/notesToSources', () => ({ syncNoteToSource }));

  const route = await import('./+server');
  return { route, syncNoteToSource, triggerSummaryGeneration, indexNoteMemory };
}

describe('POST /api/notes note save', () => {
  it('does not sync ordinary note saves into the experimental wiki/source subsystem', async () => {
    const { route, syncNoteToSource, triggerSummaryGeneration, indexNoteMemory } = await loadRouteWithMocks();

    const response = await route.POST({
      request: new Request('http://localhost/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: savedNote }),
      }),
      locals: { user: { id: 'user-1', username: 'tester' } },
    } as Parameters<typeof route.POST>[0]);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, note: { ...savedNote, version: 1 } });
    expect(triggerSummaryGeneration).toHaveBeenCalledWith('user-1', savedNote.id, savedNote.title, savedNote.content);
    expect(indexNoteMemory).toHaveBeenCalledWith({ userId: 'user-1', note: { ...savedNote, version: 1 } });
    expect(syncNoteToSource).not.toHaveBeenCalled();
  });
});
