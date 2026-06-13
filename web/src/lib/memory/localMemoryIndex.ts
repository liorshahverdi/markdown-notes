import { getDb } from '$lib/server/database';
import { chunkText, cosineSimilarity } from '$lib/vector/vectorStore';
import { embedBatch, embedText } from '$lib/vector/serverEmbeddings';
import type { NoteRecord } from '../../types/note';

export interface MemoryIndexMatch {
  noteId: string;
  title: string;
  chunkText: string;
  score: number;
  chunkIndex: number;
}

interface MemoryChunkRow {
  id: string;
  userId: string;
  noteId: string;
  title: string;
  chunkIndex: number;
  chunkText: string;
  contentHash: string;
  embeddingJson: string;
  embeddingModel: string;
  updatedAt: number;
}

export type EmbedTexts = (texts: string[]) => Promise<number[][]>;

const DEFAULT_EMBEDDING_MODEL = 'nomic-embed-text';

export function memoryContentHash(note: Pick<NoteRecord, 'title' | 'content'>): string {
  const input = `${note.title}\n\n${note.content}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function chunkId(userId: string, noteId: string, chunkIndex: number): string {
  return `${userId}:${noteId}:${chunkIndex}`;
}

function ensureMemorySchema(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS memory_chunks (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      noteId TEXT NOT NULL,
      title TEXT NOT NULL,
      chunkIndex INTEGER NOT NULL,
      chunkText TEXT NOT NULL,
      contentHash TEXT NOT NULL,
      embeddingJson TEXT NOT NULL,
      embeddingModel TEXT NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_memory_chunks_user_note ON memory_chunks(userId, noteId);
    CREATE INDEX IF NOT EXISTS idx_memory_chunks_user ON memory_chunks(userId);
  `);
}

async function defaultEmbedTexts(texts: string[]): Promise<number[][]> {
  return embedBatch(texts);
}

export async function indexNoteMemory(input: {
  userId: string;
  note: NoteRecord;
  embedTexts?: EmbedTexts;
  embeddingModel?: string;
}): Promise<{ indexedChunks: number; skipped: boolean }> {
  ensureMemorySchema();
  const db = getDb();
  const contentHash = memoryContentHash(input.note);
  const existing = db
    .prepare('SELECT contentHash FROM memory_chunks WHERE userId = ? AND noteId = ? LIMIT 1')
    .get(input.userId, input.note.id) as { contentHash: string } | undefined;
  if (existing?.contentHash === contentHash) {
    return { indexedChunks: 0, skipped: true };
  }

  const chunks = chunkText(`${input.note.title}\n\n${input.note.content}`);
  const vectors = chunks.length > 0 ? await (input.embedTexts ?? defaultEmbedTexts)(chunks) : [];
  const now = Date.now();
  const embeddingModel = input.embeddingModel ?? DEFAULT_EMBEDDING_MODEL;

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM memory_chunks WHERE userId = ? AND noteId = ?').run(input.userId, input.note.id);
    const insert = db.prepare(`
      INSERT INTO memory_chunks
        (id, userId, noteId, title, chunkIndex, chunkText, contentHash, embeddingJson, embeddingModel, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    chunks.forEach((chunk, index) => {
      insert.run(
        chunkId(input.userId, input.note.id, index),
        input.userId,
        input.note.id,
        input.note.title,
        index,
        chunk,
        contentHash,
        JSON.stringify(vectors[index] ?? []),
        embeddingModel,
        now
      );
    });
  });
  tx();

  return { indexedChunks: chunks.length, skipped: false };
}

export function deleteNoteMemory(userId: string, noteId: string): void {
  ensureMemorySchema();
  getDb().prepare('DELETE FROM memory_chunks WHERE userId = ? AND noteId = ?').run(userId, noteId);
}

export function readMemoryIndexStats(userId: string): { chunkCount: number; noteCount: number; lastUpdatedAt: number | null } {
  ensureMemorySchema();
  const row = getDb()
    .prepare('SELECT COUNT(*) AS chunkCount, COUNT(DISTINCT noteId) AS noteCount, MAX(updatedAt) AS lastUpdatedAt FROM memory_chunks WHERE userId = ?')
    .get(userId) as { chunkCount: number; noteCount: number; lastUpdatedAt: number | null };
  return row;
}

export async function searchLocalMemory(input: {
  userId: string;
  query: string;
  topK?: number;
  embedTexts?: EmbedTexts;
}): Promise<MemoryIndexMatch[]> {
  ensureMemorySchema();
  const topK = input.topK ?? 5;
  const rows = getDb()
    .prepare('SELECT * FROM memory_chunks WHERE userId = ?')
    .all(input.userId) as MemoryChunkRow[];
  if (rows.length === 0) return [];

  const [queryVector] = input.embedTexts ? await input.embedTexts([input.query]) : [await embedText(input.query)];
  const bestByNote = new Map<string, MemoryIndexMatch>();

  for (const row of rows) {
    let vector: number[];
    try {
      vector = JSON.parse(row.embeddingJson) as number[];
    } catch {
      continue;
    }
    if (vector.length === 0 || vector.length !== queryVector.length) continue;
    const score = cosineSimilarity(queryVector, vector);
    const match: MemoryIndexMatch = {
      noteId: row.noteId,
      title: row.title,
      chunkText: row.chunkText,
      score,
      chunkIndex: row.chunkIndex,
    };
    const existing = bestByNote.get(row.noteId);
    if (!existing || match.score > existing.score) bestByNote.set(row.noteId, match);
  }

  return Array.from(bestByNote.values())
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export async function ensureUserMemoryIndex(input: {
  userId: string;
  notes: NoteRecord[];
  embedTexts?: EmbedTexts;
}): Promise<{ indexedNotes: number; skippedNotes: number }> {
  let indexedNotes = 0;
  let skippedNotes = 0;
  for (const note of input.notes) {
    const result = await indexNoteMemory({ userId: input.userId, note, embedTexts: input.embedTexts });
    if (result.skipped) skippedNotes += 1;
    else indexedNotes += 1;
  }
  return { indexedNotes, skippedNotes };
}
