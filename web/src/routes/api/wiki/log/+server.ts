import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { readVaultTextFile } from '$lib/server/vaultFs';
import { getUserVaultPaths } from '$lib/server/vaultPaths';

export const GET: RequestHandler = async ({ locals }) => {
  const userId = locals.user!.id;
  const db = getDb();
  const row = db.prepare('SELECT wikiPath FROM wiki_pages WHERE userId = ? AND pageType = ?').get(userId, 'log') as { wikiPath: string } | undefined;
  const wikiPath = row?.wikiPath ?? 'wiki/log.md';
  const vaultRoot = getUserVaultPaths(userId).root;

  try {
    return json({ markdown: readVaultTextFile(vaultRoot, wikiPath), wikiPath });
  } catch {
    return json({ markdown: '# Wiki Log\n', wikiPath });
  }
};
