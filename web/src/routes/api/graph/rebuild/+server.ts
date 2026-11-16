import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { clearNoteStates } from '$lib/server/graph/graphStore';
import { invalidateUserGraph } from '$lib/server/graph/graphService';
import { runGraphPassForUser } from '$lib/server/graph/graphWorker';

/**
 * Re-process every note. Proposals, rejections, merges and reviews are kept:
 * the base graph is always rebuilt from notes, and only per-note processing
 * state is reset so model stages revisit everything.
 */
export const POST: RequestHandler = async ({ locals }) => {
  const userId = locals.user!.id;
  clearNoteStates(getDb(), userId);
  invalidateUserGraph(userId);
  const run = await runGraphPassForUser(userId, 'rebuild');
  return json({ ok: run.status === 'completed', run });
};
