import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { findSession, findUserById } from '$lib/server/auth';
import { getDb } from '$lib/server/database';
import { verifyApiToken } from '$lib/server/apiTokens';
import { getRequiredApiScope, hasApiScope } from '$lib/server/apiScopes';

const PUBLIC_PATHS = ['/login', '/api/auth'];

function jsonError(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export const handle: Handle = async ({ event, resolve }) => {
  const sessionToken = event.cookies.get('session');

  if (sessionToken) {
    const session = findSession(sessionToken);
    if (session) {
      const user = findUserById(session.userId);
      if (user) {
        event.locals.user = { id: user.id, username: user.username };
        event.locals.auth = { type: 'session' };
      }
    }
  }

  const { pathname } = event.url;
  const isApiPath = pathname.startsWith('/api/');

  if (!event.locals.user && isApiPath) {
    const bearerToken = extractBearerToken(event.request.headers.get('Authorization'));
    if (bearerToken) {
      const verified = await verifyApiToken(getDb(), bearerToken);
      if (verified) {
        const user = findUserById(verified.userId);
        if (user) {
          event.locals.user = { id: user.id, username: user.username };
          event.locals.auth = {
            type: 'api-token',
            tokenId: verified.tokenId,
            scopes: verified.scopes,
          };
        }
      }
    }
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (!event.locals.user && !isPublic) {
    if (isApiPath) {
      return jsonError(401, { error: 'Unauthorized' });
    }
    throw redirect(303, '/login');
  }

  if (event.locals.user && isApiPath) {
    const requiredScope = getRequiredApiScope(event.request.method, pathname);
    if (requiredScope && !hasApiScope(event.locals.auth, requiredScope)) {
      return jsonError(403, { error: 'Forbidden', requiredScope });
    }
  }

  return resolve(event);
};
