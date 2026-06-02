import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { getLatestWikiMutation } from '$lib/wiki/latestMutation';

export const GET: RequestHandler = async ({ locals }) => {
  return json({ mutation: getLatestWikiMutation(getDb(), locals.user!.id) });
};
