import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getDb } from './database';

interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: number;
}

interface Session {
  token: string;
  userId: string;
  expiresAt: number;
}

const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

// --- Users ---

export function findUserByUsername(username: string): User | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
}

export function findUserById(id: string): User | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export async function createUser(username: string, password: string): Promise<User> {
  const db = getDb();
  const existing = findUserByUsername(username);
  if (existing) {
    throw new Error('Username already taken');
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user: User = {
    id: randomUUID(),
    username,
    passwordHash,
    createdAt: Date.now(),
  };
  db.prepare('INSERT INTO users (id, username, passwordHash, createdAt) VALUES (?, ?, ?, ?)').run(
    user.id,
    user.username,
    user.passwordHash,
    user.createdAt
  );
  return user;
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.passwordHash);
}

// --- Sessions ---

export function createSession(userId: string): string {
  const db = getDb();
  // Clean expired sessions
  db.prepare('DELETE FROM sessions WHERE expiresAt <= ?').run(Date.now());

  const token = randomUUID();
  db.prepare('INSERT INTO sessions (token, userId, expiresAt) VALUES (?, ?, ?)').run(
    token,
    userId,
    Date.now() + SESSION_TTL
  );
  return token;
}

export function findSession(token: string): Session | undefined {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE token = ? AND expiresAt > ?').get(
    token,
    Date.now()
  ) as Session | undefined;
  return session;
}

export function deleteSession(token: string): void {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}
