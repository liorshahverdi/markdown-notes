import { describe, expect, it, vi } from 'vitest';

async function loadHandle(options: {
  sessionUserId?: string;
  tokenUserId?: string;
  tokenScopes?: string[];
}) {
  vi.resetModules();
  vi.doMock('$lib/server/auth', () => ({
    findSession: vi.fn((token: string) =>
      token === 'session-token' && options.sessionUserId
        ? { token, userId: options.sessionUserId, expiresAt: Date.now() + 1000 }
        : undefined
    ),
    findUserById: vi.fn((id: string) => ({ id, username: id === 'user-1' ? 'tester' : 'token-user' })),
  }));
  vi.doMock('$lib/server/database', () => ({ getDb: () => ({ id: 'db' }) }));
  vi.doMock('$lib/server/apiTokens', () => ({
    verifyApiToken: vi.fn(async (_db: unknown, token: string) =>
      token === 'valid-token' && options.tokenUserId
        ? { userId: options.tokenUserId, tokenId: 'tok-1', scopes: options.tokenScopes ?? [] }
        : null
    ),
  }));
  return import('./hooks.server');
}

function createEvent(pathname: string, init?: { cookie?: string; bearer?: string }) {
  const headers = new Headers();
  if (init?.bearer) headers.set('Authorization', `Bearer ${init.bearer}`);
  return {
    cookies: { get: (name: string) => (name === 'session' ? init?.cookie : undefined) },
    url: new URL(`http://localhost${pathname}`),
    request: new Request(`http://localhost${pathname}`, { headers }),
    locals: {},
  } as any;
}

describe('server auth hook', () => {
  it('keeps session-cookie authentication working', async () => {
    const { handle } = await loadHandle({ sessionUserId: 'user-1' });
    const event = createEvent('/api/notes', { cookie: 'session-token' });
    const resolve = vi.fn(() => new Response('ok'));

    const response = await handle({ event, resolve } as any);

    expect(response.status).toBe(200);
    expect(event.locals.user).toEqual({ id: 'user-1', username: 'tester' });
    expect(event.locals.auth).toEqual({ type: 'session' });
  });

  it('authenticates API requests with bearer tokens', async () => {
    const { handle } = await loadHandle({ tokenUserId: 'user-2', tokenScopes: ['notes:read'] });
    const event = createEvent('/api/notes', { bearer: 'valid-token' });
    const resolve = vi.fn(() => new Response('ok'));

    const response = await handle({ event, resolve } as any);

    expect(response.status).toBe(200);
    expect(event.locals.user).toEqual({ id: 'user-2', username: 'token-user' });
    expect(event.locals.auth).toEqual({ type: 'api-token', tokenId: 'tok-1', scopes: ['notes:read'] });
  });

  it('rejects invalid bearer tokens for API requests', async () => {
    const { handle } = await loadHandle({});
    const response = await handle({
      event: createEvent('/api/notes', { bearer: 'bad-token' }),
      resolve: vi.fn(() => new Response('should not resolve')),
    } as any);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('does not allow bearer tokens to authenticate page requests', async () => {
    const { handle } = await loadHandle({ tokenUserId: 'user-2', tokenScopes: ['notes:read'] });

    await expect(
      handle({
        event: createEvent('/graph', { bearer: 'valid-token' }),
        resolve: vi.fn(() => new Response('should not resolve')),
      } as any)
    ).rejects.toMatchObject({ status: 303, location: '/login' });
  });

  it('rejects token-authenticated writes without the required write scope', async () => {
    const { handle } = await loadHandle({ tokenUserId: 'user-2', tokenScopes: ['notes:read'] });
    const event = createEvent('/api/notes', { bearer: 'valid-token' });
    event.request = new Request('http://localhost/api/notes', { method: 'POST', headers: { Authorization: 'Bearer valid-token' } });

    const response = await handle({ event, resolve: vi.fn(() => new Response('should not resolve')) } as any);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden', requiredScope: 'notes:write' });
  });
});
