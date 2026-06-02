import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { join } from 'node:path';
import { getDb } from '$lib/server/database';
import { runWikiLint } from '$lib/wiki/lint/wikiLint';

const DEFAULT_USER_ID = 'user-1';

export const GET: RequestHandler = async ({ locals }) => {
  return json(runWikiLint({
    db: getDb(),
    userId: locals.user?.id ?? DEFAULT_USER_ID,
    baseDir: join(process.cwd(), 'data'),
  }));
};
