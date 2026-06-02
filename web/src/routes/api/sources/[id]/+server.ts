import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { getRawSourceRow } from '$lib/wiki/ingest/sourceImporter';

export const GET: RequestHandler = async ({ params, locals }) => {
  const db = getDb();
  const source = getRawSourceRow(db, locals.user!.id, params.id);

  if (!source) {
    throw error(404, 'Source not found');
  }

  return json({ source });
};
