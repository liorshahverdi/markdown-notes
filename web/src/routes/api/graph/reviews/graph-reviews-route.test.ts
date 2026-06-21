import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeDatabase } from '$lib/server/database';
import { readGraphRelationReviews } from '$lib/server/graphRelationReviews';

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

describe('POST /api/graph/reviews', () => {
  it('persists a graph edge review for the authenticated user', async () => {
    const db = new Database(':memory:');
    dbs.push(db);
    initializeDatabase(db);
    const route = await loadRouteWithDb(db);

    const response = await route.POST({
      request: new Request('http://localhost/api/graph/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewKey: 'depends_on:alpha->beta',
          fromName: 'Alpha',
          toName: 'Beta',
          relationType: 'depends_on',
          accepted: false,
          rejected: true,
        }),
      }),
      locals: { user: { id: 'user-1', username: 'tester' } },
    } as Parameters<typeof route.POST>[0]);

    expect(response.status).toBe(200);
    expect(readGraphRelationReviews(db, 'user-1').get('depends_on:alpha->beta')).toMatchObject({ rejected: true });
  });
});
