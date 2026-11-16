import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { recordAnswerFeedback } from '$lib/server/graph/graphService';

/**
 * Answer feedback: the user opened a cited note/edge from a chat answer.
 * Credits the edges and records (query → note) for the retrieval eval set.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  const body = (await request.json()) as { query?: unknown; noteId?: unknown; relationIds?: unknown };
  const relationIds = Array.isArray(body.relationIds) ? body.relationIds.filter((id): id is string => typeof id === 'string') : [];
  const query = typeof body.query === 'string' ? body.query : undefined;
  const noteId = typeof body.noteId === 'string' ? body.noteId : undefined;
  if (!noteId && relationIds.length === 0) throw error(400, 'noteId or relationIds required');
  const result = recordAnswerFeedback(getDb(), locals.user!.id, { query, noteId, relationIds });
  return json({ ok: true, ...result });
};
