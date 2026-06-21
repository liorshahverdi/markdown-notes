import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeDatabase } from '$lib/server/database';
import { verifyApiToken } from '$lib/server/apiTokens';

const dbs: Database.Database[] = [];

afterEach(() => {
  vi.doUnmock('$lib/server/database');
  while (dbs.length > 0) dbs.pop()?.close();
});

async function loadRouteWithDb(db: Database.Database) {
  vi.resetModules();
  vi.doMock('$lib/server/database', () => ({ getDb: () => db }));
  return import('./+server');
}

function createDb(): Database.Database {
  const db = new Database(':memory:');
  dbs.push(db);
  initializeDatabase(db);
  db.prepare('INSERT INTO users (id, username, passwordHash, createdAt) VALUES (?, ?, ?, ?)').run(
    'user-1',
    'tester',
    'hash',
    Date.now()
  );
  return db;
}

describe('/api/tokens', () => {
  it('lets a session user create a token and returns the full token once', async () => {
    const db = createDb();
    const route = await loadRouteWithDb(db);

    const response = await route.POST({
      request: new Request('http://localhost/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'CLI', scopes: ['notes:read', 'query:read'], expiresInDays: 30 }),
      }),
      locals: { user: { id: 'user-1', username: 'tester' }, auth: { type: 'session' } },
    } as Parameters<typeof route.POST>[0]);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.token).toMatch(/^mnpat_/);
    expect(body.record).toMatchObject({ name: 'CLI', scopes: ['notes:read', 'query:read'] });
    expect(body.record.secretHash).toBeUndefined();
    await expect(verifyApiToken(db, body.token)).resolves.toMatchObject({ userId: 'user-1' });
  });

  it('lists token metadata without exposing full tokens or hashes', async () => {
    const db = createDb();
    const route = await loadRouteWithDb(db);
    await route.POST({
      request: new Request('http://localhost/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'CLI', scopes: ['notes:read'] }),
      }),
      locals: { user: { id: 'user-1', username: 'tester' }, auth: { type: 'session' } },
    } as Parameters<typeof route.POST>[0]);

    const response = await route.GET({
      locals: { user: { id: 'user-1', username: 'tester' }, auth: { type: 'session' } },
    } as Parameters<typeof route.GET>[0]);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.tokens).toHaveLength(1);
    expect(body.tokens[0].tokenPrefix).toMatch(/^mnpat_/);
    expect(body.tokens[0].token).toBeUndefined();
    expect(body.tokens[0].secretHash).toBeUndefined();
  });

  it('revokes a token owned by the session user', async () => {
    const db = createDb();
    const route = await loadRouteWithDb(db);
    const created = await route.POST({
      request: new Request('http://localhost/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'CLI', scopes: ['notes:read'] }),
      }),
      locals: { user: { id: 'user-1', username: 'tester' }, auth: { type: 'session' } },
    } as Parameters<typeof route.POST>[0]);
    const { token, record } = await created.json();

    const response = await route.DELETE({
      request: new Request('http://localhost/api/tokens', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: record.id }),
      }),
      locals: { user: { id: 'user-1', username: 'tester' }, auth: { type: 'session' } },
    } as Parameters<typeof route.DELETE>[0]);

    expect(response.status).toBe(200);
    await expect(verifyApiToken(db, token)).resolves.toBeNull();
  });

  it('does not let an API token mint another API token', async () => {
    const db = createDb();
    const route = await loadRouteWithDb(db);

    const response = await route.POST({
      request: new Request('http://localhost/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Nested', scopes: ['notes:read'] }),
      }),
      locals: {
        user: { id: 'user-1', username: 'tester' },
        auth: { type: 'api-token', tokenId: 'tok-1', scopes: ['tokens:manage'] },
      },
    } as Parameters<typeof route.POST>[0]);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'API tokens must be managed from a browser session' });
  });
});
