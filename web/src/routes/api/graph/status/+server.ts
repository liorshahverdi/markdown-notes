import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { readNotes } from '$lib/server/notesFile';
import { getGraphStatus } from '$lib/server/graph/graphWorker';

/** Lightweight loop status for the header pill (polled). */
export const GET: RequestHandler = async ({ locals }) => {
  const userId = locals.user!.id;
  return json(getGraphStatus(getDb(), userId, readNotes(userId)));
};
