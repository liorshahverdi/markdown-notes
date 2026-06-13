import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readNotes, readNote, upsertNote, deleteNote } from '$lib/server/notesFile';
import { getDb } from '$lib/server/database';
import { triggerSummaryGeneration } from '$lib/server/noteSummarizer';
import { syncNoteToSource } from '$lib/wiki/migration/notesToSources';
import { indexNoteMemory, deleteNoteMemory } from '$lib/memory/localMemoryIndex';
import { createHash } from 'crypto';

export const GET: RequestHandler = async ({ url, request, locals }) => {
  const userId = locals.user!.id;
  const id = url.searchParams.get('id');
  const search = url.searchParams.get('search');

  if (id) {
    const note = readNote(userId, id);
    return json({ note: note ?? null });
  }

  let allNotes = readNotes(userId);

  // Sorting
  const sort = url.searchParams.get('sort') ?? 'dateModified';
  if (sort === 'title') {
    allNotes.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    allNotes.sort((a, b) => b.dateModified - a.dateModified);
  }

  if (search) {
    const query = search.toLowerCase();
    allNotes = allNotes.filter(
      (n) =>
        n.title.toLowerCase().includes(query) ||
        n.content.toLowerCase().includes(query)
    );
  }

  // Pagination
  const total = allNotes.length;
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
  const limitParam = url.searchParams.get('limit');
  if (limitParam) {
    const limit = parseInt(limitParam, 10);
    allNotes = allNotes.slice(offset, offset + limit);
  }

  const body = JSON.stringify({ notes: allNotes, total });
  const etag = '"' + createHash('md5').update(body).digest('hex') + '"';

  const ifNoneMatch = request.headers.get('If-None-Match');
  if (ifNoneMatch === etag) {
    return new Response(null, { status: 304 });
  }

  return new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'ETag': etag,
    },
  });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const userId = locals.user!.id;
  const body = await request.json();

  // Single note upsert (with optional optimistic locking)
  if (body.note) {
    const expectedVersion = body.expectedVersion as number | undefined;
    const result = upsertNote(userId, body.note, expectedVersion);
    if (!result.ok && 'conflict' in result) {
      return json(
        { ok: false, conflict: true, serverNote: result.serverNote },
        { status: 409 }
      );
    }
    // Trigger async summary generation (non-blocking)
    triggerSummaryGeneration(userId, body.note.id, body.note.title, body.note.content);
    const savedNote = readNote(userId, body.note.id);
    const noteForIndex = savedNote ?? body.note;
    syncNoteToSource({ db: getDb(), userId, baseDir: 'data', note: noteForIndex });
    void indexNoteMemory({ userId, note: noteForIndex }).catch((err) => {
      console.warn('[Notes] Failed to update local memory index', err);
    });
    return json({ ok: true, note: savedNote });
  }

  // Bulk write (for migration)
  if (Array.isArray(body.notes)) {
    for (const note of body.notes) {
      upsertNote(userId, note);
    }
    return json({ ok: true, count: body.notes.length });
  }

  throw error(400, 'Request body must contain "note" or "notes"');
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
  const userId = locals.user!.id;
  const id = url.searchParams.get('id');
  if (!id) {
    throw error(400, 'Missing note id');
  }
  const deleted = deleteNote(userId, id);
  if (deleted) deleteNoteMemory(userId, id);
  return json({ ok: deleted });
};
