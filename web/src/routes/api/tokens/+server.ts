import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createApiToken, listApiTokens, revokeApiToken } from '$lib/server/apiTokens';
import { getDb } from '$lib/server/database';

function requireSession(locals: App.Locals): Response | null {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (locals.auth?.type !== 'session') {
    return json({ error: 'API tokens must be managed from a browser session' }, { status: 403 });
  }
  return null;
}

function parseExpiresAt(expiresInDays: unknown): number | null {
  if (expiresInDays === undefined || expiresInDays === null || expiresInDays === '') return null;
  if (typeof expiresInDays !== 'number' || !Number.isFinite(expiresInDays)) {
    throw new Error('expiresInDays must be a number');
  }
  if (expiresInDays <= 0 || expiresInDays > 3650) {
    throw new Error('expiresInDays must be between 1 and 3650');
  }
  return Date.now() + Math.round(expiresInDays * 24 * 60 * 60 * 1000);
}

export const GET: RequestHandler = async ({ locals }) => {
  const error = requireSession(locals);
  if (error) return error;

  return json({ tokens: listApiTokens(getDb(), locals.user!.id) });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const error = requireSession(locals);
  if (error) return error;

  try {
    const body = (await request.json()) as {
      name?: unknown;
      scopes?: unknown;
      expiresInDays?: unknown;
    };

    if (typeof body.name !== 'string') {
      return json({ error: 'Token name required' }, { status: 400 });
    }
    if (body.scopes !== undefined && !Array.isArray(body.scopes)) {
      return json({ error: 'scopes must be an array' }, { status: 400 });
    }

    const result = await createApiToken(getDb(), {
      userId: locals.user!.id,
      name: body.name,
      scopes: body.scopes?.filter((scope): scope is string => typeof scope === 'string'),
      expiresAt: parseExpiresAt(body.expiresInDays),
    });

    return json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create API token';
    return json({ error: message }, { status: 400 });
  }
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
  const error = requireSession(locals);
  if (error) return error;

  const body = (await request.json()) as { id?: unknown };
  if (typeof body.id !== 'string' || !body.id.trim()) {
    return json({ error: 'Token id required' }, { status: 400 });
  }

  const revoked = revokeApiToken(getDb(), locals.user!.id, body.id);
  if (!revoked) {
    return json({ error: 'Token not found' }, { status: 404 });
  }

  return json({ ok: true });
};
