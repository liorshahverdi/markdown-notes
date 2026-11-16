import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFolders, upsertFolder, deleteFolder } from '$lib/server/notesFile';
import { enqueueGraphUpdate } from '$lib/server/graph/graphWorker';

export const GET: RequestHandler = async ({ locals }) => {
  const userId = locals.user!.id;
  const folders = readFolders(userId);
  return json({ folders });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const userId = locals.user!.id;
  const body = await request.json();

  if (!body.folder) {
    throw error(400, 'Request body must contain "folder"');
  }

  upsertFolder(userId, body.folder);
  enqueueGraphUpdate(userId, 'folder-change');
  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
  const userId = locals.user!.id;
  const id = url.searchParams.get('id');
  if (!id) {
    throw error(400, 'Missing folder id');
  }
  const deleted = deleteFolder(userId, id);
  if (deleted) enqueueGraphUpdate(userId, 'folder-change');
  return json({ ok: deleted });
};
