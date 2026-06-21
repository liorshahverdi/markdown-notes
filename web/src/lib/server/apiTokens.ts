import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { DEFAULT_API_TOKEN_SCOPES, normalizeApiScopes } from './apiScopes';

type SqliteDatabase = import('better-sqlite3').Database;

const TOKEN_PREFIX = 'mnpat';

interface ApiTokenRow {
  id: string;
  userId: string;
  name: string;
  tokenId: string;
  tokenPrefix: string;
  secretHash: string;
  scopesJson: string;
  createdAt: number;
  lastUsedAt: number | null;
  expiresAt: number | null;
  revokedAt: number | null;
}

export interface ApiTokenSummary {
  id: string;
  userId: string;
  name: string;
  tokenId: string;
  tokenPrefix: string;
  scopes: string[];
  createdAt: number;
  lastUsedAt: number | null;
  expiresAt: number | null;
  revokedAt: number | null;
}

export interface VerifiedApiToken {
  userId: string;
  tokenId: string;
  scopes: string[];
}

function randomHex(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

function parseScopes(scopesJson: string): string[] {
  try {
    const parsed = JSON.parse(scopesJson);
    return Array.isArray(parsed) ? parsed.filter((scope): scope is string => typeof scope === 'string') : [];
  } catch {
    return [];
  }
}

function toSummary(row: ApiTokenRow): ApiTokenSummary {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    tokenId: row.tokenId,
    tokenPrefix: row.tokenPrefix,
    scopes: parseScopes(row.scopesJson),
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  };
}

export async function createApiToken(
  db: SqliteDatabase,
  input: { userId: string; name: string; scopes?: string[]; expiresAt?: number | null }
): Promise<{ token: string; record: ApiTokenSummary }> {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 80) {
    throw new Error('Token name must be 1-80 characters');
  }

  const scopes = normalizeApiScopes(input.scopes?.length ? input.scopes : DEFAULT_API_TOKEN_SCOPES);
  const tokenId = randomHex(8);
  const secret = randomHex(32);
  const token = `${TOKEN_PREFIX}_${tokenId}_${secret}`;
  const tokenPrefix = `${TOKEN_PREFIX}_${tokenId}_${secret.slice(0, 6)}`;
  const now = Date.now();
  const secretHash = await bcrypt.hash(secret, 10);

  const row: ApiTokenRow = {
    id: randomUUID(),
    userId: input.userId,
    name,
    tokenId,
    tokenPrefix,
    secretHash,
    scopesJson: JSON.stringify(scopes),
    createdAt: now,
    lastUsedAt: null,
    expiresAt: input.expiresAt ?? null,
    revokedAt: null,
  };

  db.prepare(
    `INSERT INTO api_tokens (id, userId, name, tokenId, tokenPrefix, secretHash, scopesJson, createdAt, lastUsedAt, expiresAt, revokedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    row.id,
    row.userId,
    row.name,
    row.tokenId,
    row.tokenPrefix,
    row.secretHash,
    row.scopesJson,
    row.createdAt,
    row.lastUsedAt,
    row.expiresAt,
    row.revokedAt
  );

  return { token, record: toSummary(row) };
}

export async function verifyApiToken(db: SqliteDatabase, token: string): Promise<VerifiedApiToken | null> {
  const match = /^mnpat_([a-f0-9]{16})_([a-f0-9]{64})$/.exec(token);
  if (!match) return null;

  const [, tokenId, secret] = match;
  const row = db.prepare('SELECT * FROM api_tokens WHERE tokenId = ?').get(tokenId) as ApiTokenRow | undefined;
  if (!row) return null;
  if (row.revokedAt !== null && row.revokedAt !== undefined) return null;
  if (row.expiresAt !== null && row.expiresAt !== undefined && row.expiresAt <= Date.now()) return null;

  const valid = await bcrypt.compare(secret, row.secretHash);
  if (!valid) return null;

  touchApiTokenLastUsed(db, tokenId);
  return { userId: row.userId, tokenId: row.tokenId, scopes: parseScopes(row.scopesJson) };
}

export function listApiTokens(db: SqliteDatabase, userId: string): ApiTokenSummary[] {
  const rows = db
    .prepare('SELECT * FROM api_tokens WHERE userId = ? ORDER BY createdAt DESC')
    .all(userId) as ApiTokenRow[];
  return rows.map(toSummary);
}

export function revokeApiToken(db: SqliteDatabase, userId: string, idOrTokenId: string): boolean {
  const result = db
    .prepare('UPDATE api_tokens SET revokedAt = ? WHERE userId = ? AND (id = ? OR tokenId = ?) AND revokedAt IS NULL')
    .run(Date.now(), userId, idOrTokenId, idOrTokenId);
  return result.changes > 0;
}

export function touchApiTokenLastUsed(db: SqliteDatabase, tokenId: string, now = Date.now()): void {
  db.prepare('UPDATE api_tokens SET lastUsedAt = ? WHERE tokenId = ?').run(now, tokenId);
}
