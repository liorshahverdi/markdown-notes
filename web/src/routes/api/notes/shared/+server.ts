import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readSharedNotes } from '$lib/server/notesFile';
import { findUserById } from '$lib/server/auth';

export const GET: RequestHandler = async ({ locals }) => {
  const userId = locals.user!.id;
  const shared = readSharedNotes(userId);

  // Attach owner usernames
  const withUsernames = shared.map((note) => {
    const owner = note.ownerId ? findUserById(note.ownerId) : undefined;
    return {
      ...note,
      ownerUsername: owner?.username ?? 'Unknown',
    };
  });

  return json({ notes: withUsernames });
};
