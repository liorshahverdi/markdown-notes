import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { findSession, findUserById } from '$lib/server/auth';

const PUBLIC_PATHS = ['/login', '/api/auth'];

export const handle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get('session');

  if (token) {
    const session = findSession(token);
    if (session) {
      const user = findUserById(session.userId);
      if (user) {
        event.locals.user = { id: user.id, username: user.username };
      }
    }
  }

  const { pathname } = event.url;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (!event.locals.user && !isPublic) {
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw redirect(303, '/login');
  }

  return resolve(event);
};
