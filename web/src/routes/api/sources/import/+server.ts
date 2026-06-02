import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { importSourceText } from '$lib/wiki/ingest/sourceImporter';

export const POST: RequestHandler = async ({ request, locals }) => {
  const body = await request.json();

  if (!body || typeof body.title !== 'string' || typeof body.content !== 'string') {
    throw error(400, 'Request body must contain string title and content');
  }

  const db = getDb();
  const result = importSourceText({
    db,
    userId: locals.user!.id,
    baseDir: 'data',
    title: body.title,
    content: body.content,
    sourceType: typeof body.sourceType === 'string' ? body.sourceType : undefined,
  });

  return json({ source: result.record });
};
