import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { getDataDir } from '$lib/server/dataDir';
import { migrateNotesToSources } from '$lib/wiki/migration/notesToSources';

const DEFAULT_USER_ID = 'user-1';

export const POST: RequestHandler = async ({ locals }) => {
  const result = migrateNotesToSources({
    db: getDb(),
    userId: locals.user?.id ?? DEFAULT_USER_ID,
    baseDir: getDataDir(),
  });

  return json(result);
};
