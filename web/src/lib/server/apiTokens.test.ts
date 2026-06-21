import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeDatabase } from './database';
import {
  createApiToken,
  listApiTokens,
  revokeApiToken,
  verifyApiToken,
} from './apiTokens';

const dbs: Database.Database[] = [];

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

afterEach(() => {
  while (dbs.length > 0) dbs.pop()?.close();
});

describe('api token helpers', () => {
  it('creates a token and stores only hashed secret material', async () => {
    const db = createDb();

    const { token, record } = await createApiToken(db, {
      userId: 'user-1',
      name: 'CLI',
      scopes: ['notes:read', 'query:read'],
      expiresAt: null,
    });

    expect(token).toMatch(/^mnpat_[a-f0-9]+_[a-f0-9]+$/);
    expect(record.tokenPrefix).toMatch(/^mnpat_[a-f0-9]+_/);
    expect(record.scopes).toEqual(['notes:read', 'query:read']);

    const row = db.prepare('SELECT * FROM api_tokens WHERE id = ?').get(record.id) as any;
    expect(row.secretHash).toBeTruthy();
    expect(row.secretHash).not.toContain(token);
    expect(row.secretHash).not.toContain(token.split('_')[2]);
  });

  it('verifies a valid token and updates last-used metadata', async () => {
    const db = createDb();
    const { token, record } = await createApiToken(db, {
      userId: 'user-1',
      name: 'MCP',
      scopes: ['graph:read'],
      expiresAt: null,
    });

    const verified = await verifyApiToken(db, token);

    expect(verified).toMatchObject({
      userId: 'user-1',
      tokenId: record.tokenId,
      scopes: ['graph:read'],
    });
    expect(listApiTokens(db, 'user-1')[0].lastUsedAt).toEqual(expect.any(Number));
  });

  it('rejects malformed tokens', async () => {
    const db = createDb();
    await expect(verifyApiToken(db, 'not-a-token')).resolves.toBeNull();
    await expect(verifyApiToken(db, 'mnpat_missing')).resolves.toBeNull();
  });

  it('rejects revoked tokens', async () => {
    const db = createDb();
    const { token, record } = await createApiToken(db, {
      userId: 'user-1',
      name: 'Old CLI',
      scopes: ['notes:read'],
      expiresAt: null,
    });

    revokeApiToken(db, 'user-1', record.id);

    await expect(verifyApiToken(db, token)).resolves.toBeNull();
  });

  it('rejects expired tokens', async () => {
    const db = createDb();
    const { token } = await createApiToken(db, {
      userId: 'user-1',
      name: 'Expired',
      scopes: ['notes:read'],
      expiresAt: Date.now() - 1000,
    });

    await expect(verifyApiToken(db, token)).resolves.toBeNull();
  });

  it('lists and revokes tokens only for the owning user', async () => {
    const db = createDb();
    db.prepare('INSERT INTO users (id, username, passwordHash, createdAt) VALUES (?, ?, ?, ?)').run(
      'user-2',
      'other',
      'hash',
      Date.now()
    );
    const { record } = await createApiToken(db, {
      userId: 'user-1',
      name: 'CLI',
      scopes: ['notes:read'],
      expiresAt: null,
    });

    expect(listApiTokens(db, 'user-2')).toHaveLength(0);
    expect(revokeApiToken(db, 'user-2', record.id)).toBe(false);
    expect(revokeApiToken(db, 'user-1', record.id)).toBe(true);
    expect(listApiTokens(db, 'user-1')[0].revokedAt).toEqual(expect.any(Number));
  });
});
