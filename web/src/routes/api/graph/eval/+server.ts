import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { readFolders, readNotes } from '$lib/server/notesFile';
import { addEvalQuery, deleteEvalQuery, readEvalQueries } from '$lib/server/graph/graphStore';
import { runRetrievalEval } from '$lib/server/graph/graphEval';
import { getUserGraph } from '$lib/server/graph/graphService';

/** Saved question → expected-note pairs and the current retrieval score. */
export const GET: RequestHandler = async ({ locals }) => {
  const userId = locals.user!.id;
  const queries = readEvalQueries(getDb(), userId);
  const notes = readNotes(userId);
  const folders = readFolders(userId);
  const result = runRetrievalEval({ queries, notes, folders, graph: getUserGraph(userId, { notes, folders }) });
  return json({ queries, result });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const body = (await request.json()) as { query?: unknown; expectedNoteId?: unknown };
  if (typeof body.query !== 'string' || typeof body.expectedNoteId !== 'string') {
    throw error(400, 'query and expectedNoteId are required');
  }
  const added = addEvalQuery(getDb(), locals.user!.id, body.query, body.expectedNoteId, 'manual');
  return json({ ok: true, added });
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
  const id = url.searchParams.get('id');
  if (!id) throw error(400, 'id is required');
  return json({ ok: deleteEvalQuery(getDb(), locals.user!.id, id) });
};
