import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { listRawSourceRows } from '$lib/wiki/ingest/sourceImporter';

export const GET: RequestHandler = async ({ locals }) => {
  const userId = locals.user!.id;
  const db = getDb();
  const sources = listRawSourceRows(db, userId);
  return json({ sources });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const body = await request.json();
  if (!body || typeof body.title !== 'string' || typeof body.content !== 'string') {
    throw error(400, 'Request body must contain string title and content');
  }

  const forwardRequest = new Request(new URL('/api/sources/import', request.url), {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(body),
  });

  return fetch(forwardRequest);
};
