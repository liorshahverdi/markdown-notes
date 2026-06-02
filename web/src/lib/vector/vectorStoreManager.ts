import { writable, get } from 'svelte/store';
import { VectorStore, chunkText } from './vectorStore';
import { notes } from '../stores/notes';
import { ragConfig } from '../stores/rag';
import { getFolderPath } from '../stores/folders';
import { db } from '../db';
import type { NoteRecord } from '../../types/note';

export interface SearchResult {
  noteId: string;
  title: string;
  chunkText: string;
  score: number;
}

// Singleton state
let store: VectorStore | null = null;
let worker: Worker | null = null;
let unsubscribe: (() => void) | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const pendingRequests = new Map<string, { resolve: (v: number[][]) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
let requestCounter = 0;

// Content hashes for change detection
const contentHashes = new Map<string, string>();

// Serialization lock for syncNotes
let syncPromise: Promise<void> = Promise.resolve();

/** Timeout for embed requests (ms) */
const EMBED_TIMEOUT = 60_000;

/** Whether we're using Ollama for embeddings (true) or Xenova fallback (false) */
let useOllamaEmbed = true;

export const vectorStoreReady = writable(false);

/**
 * FNV-1a 52-bit hash for content fingerprinting.
 * Uses two 32-bit halves to produce a 52-bit value encoded as a hex string,
 * giving collision resistance far beyond djb2's 32 bits.
 */
function contentHash(str: string): string {
  // FNV-1a parameters
  let h1 = 0x811c9dc5; // FNV offset basis
  let h2 = 0x01000193; // secondary seed

  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c;
    h2 = Math.imul(h2, 0x1000033);
  }

  // Combine into a single hex string (52 bits of effective entropy)
  return ((h1 >>> 0) * 0x100000 + (h2 >>> 0 & 0xFFFFF)).toString(36);
}

/** Reject a pending request and clean it up */
function rejectRequest(id: string, error: Error): void {
  const pending = pendingRequests.get(id);
  if (pending) {
    clearTimeout(pending.timer);
    pendingRequests.delete(id);
    pending.reject(error);
  }
}

/** Reject all pending requests (used on worker error/termination) */
function rejectAllPending(error: Error): void {
  for (const [id, pending] of pendingRequests) {
    clearTimeout(pending.timer);
    pending.reject(error);
  }
  pendingRequests.clear();
}

/** Embed via Ollama server endpoint */
async function embedViaOllama(texts: string[]): Promise<number[][]> {
  const config = get(ragConfig);
  const response = await fetch('/api/ollama/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: texts,
      model: config.embeddingModel || 'nomic-embed-text',
      ollamaUrl: config.ollamaUrl,
    }),
    signal: AbortSignal.timeout(EMBED_TIMEOUT),
  });

  if (!response.ok) {
    throw new Error(`Ollama embed failed: ${response.status}`);
  }

  const data = await response.json();
  return data.embeddings;
}

/** Wrap worker postMessage in a promise with timeout (Xenova fallback) */
function embedViaWorker(texts: string[]): Promise<number[][]> {
  if (!worker) return Promise.reject(new Error('Worker not initialized'));
  if (texts.length === 0) return Promise.resolve([]);

  const id = `req_${++requestCounter}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      rejectRequest(id, new Error(`Embed request ${id} timed out after ${EMBED_TIMEOUT}ms`));
    }, EMBED_TIMEOUT);

    pendingRequests.set(id, { resolve, reject, timer });
    worker!.postMessage({ type: 'embed', id, texts });
  });
}

/**
 * Embed texts using Ollama (preferred) with automatic Xenova fallback.
 * Once Ollama fails, falls back to Xenova for the rest of the session.
 */
async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  if (useOllamaEmbed) {
    try {
      return await embedViaOllama(texts);
    } catch {
      console.warn('[VectorStore] Ollama embed unavailable, falling back to Xenova worker');
      useOllamaEmbed = false;
    }
  }

  return embedViaWorker(texts);
}

/** Chunk and embed a single note, adding entries to the store and persisting to IndexedDB */
async function embedNote(note: NoteRecord): Promise<void> {
  if (!store) return;

  const folderPrefix = note.folderId ? `[Folder: ${getFolderPath(note.folderId)}]\n\n` : '';
  const text = `${folderPrefix}${note.title}\n\n${note.content}`;
  const chunks = chunkText(text);
  if (chunks.length === 0) return;

  const vectors = await embed(chunks);
  const hash = contentHash(note.content);

  const entries = chunks.map((chunk, i) => ({
    id: `${note.id}_${i}`,
    noteId: note.id,
    chunkText: chunk,
    vector: vectors[i],
  }));

  for (const entry of entries) {
    store.add(entry);
  }

  // Persist to IndexedDB
  const records = entries.map((e) => ({
    id: e.id,
    noteId: e.noteId,
    textHash: hash,
    chunkText: e.chunkText,
    vector: e.vector,
  }));
  await db.embeddings.bulkPut(records);

  contentHashes.set(note.id, hash);
}

/** Diff current notes against embedded state, re-embed only what changed */
async function syncNotes(currentNotes: NoteRecord[]): Promise<void> {
  if (!store) return;

  const currentIds = new Set(currentNotes.map((n) => n.id));

  // Delete removed notes
  for (const id of contentHashes.keys()) {
    if (!currentIds.has(id)) {
      store.delete(id);
      contentHashes.delete(id);
      // Remove from IndexedDB
      const toDelete = await db.embeddings.where('noteId').equals(id).primaryKeys();
      await db.embeddings.bulkDelete(toDelete);
    }
  }

  // Add new or re-embed changed notes
  for (const note of currentNotes) {
    const hash = contentHash(note.content);
    const existing = contentHashes.get(note.id);

    if (existing === undefined) {
      // New note
      await embedNote(note);
    } else if (existing !== hash) {
      // Changed note — delete old entries from store and DB, re-embed
      store.delete(note.id);
      const toDelete = await db.embeddings.where('noteId').equals(note.id).primaryKeys();
      await db.embeddings.bulkDelete(toDelete);
      await embedNote(note);
    }
    // Unchanged — skip
  }
}

/**
 * Enqueue a syncNotes call, serialized so concurrent calls don't overlap.
 * Each call waits for the prior one to finish before starting.
 */
function enqueueSyncNotes(currentNotes: NoteRecord[]): void {
  syncPromise = syncPromise
    .then(() => syncNotes(currentNotes))
    .catch((err) => console.warn('Vector store sync error:', err));
}

/** Initialize the vector store singleton: load from IndexedDB, embed missing notes, subscribe to changes */
export async function initVectorStore(): Promise<void> {
  if (store) return; // Already initialized

  store = new VectorStore();

  // Create embeddings worker
  worker = new Worker(new URL('./embeddings.worker.ts', import.meta.url), { type: 'module' });

  // Handle worker responses
  worker.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type === 'embeddings') {
      const pending = pendingRequests.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        pendingRequests.delete(msg.id);
        pending.resolve(msg.vectors);
      }
    } else if (msg.type === 'error') {
      rejectRequest(msg.id, new Error(msg.message));
    }
  });

  // Handle worker crashes — reject all pending requests
  worker.addEventListener('error', (event) => {
    console.warn('Embeddings worker error:', event.message);
    rejectAllPending(new Error(`Worker error: ${event.message}`));
  });

  // Load persisted embeddings from IndexedDB
  const allNotes = get(notes);
  const noteContentHashes = new Map(allNotes.map((n) => [n.id, contentHash(n.content)]));

  const persisted = await db.embeddings.toArray();
  const loadedNoteIds = new Set<string>();

  for (const record of persisted) {
    const currentHash = noteContentHashes.get(record.noteId);
    // Load if note still exists and content hasn't changed
    if (currentHash !== undefined && record.textHash === currentHash) {
      store.add({
        id: record.id,
        noteId: record.noteId,
        chunkText: record.chunkText,
        vector: record.vector,
      });
      loadedNoteIds.add(record.noteId);
      contentHashes.set(record.noteId, record.textHash);
    }
  }

  // Clean up stale embeddings from IndexedDB (deleted or changed notes)
  const staleIds = persisted
    .filter((r) => !loadedNoteIds.has(r.noteId) || noteContentHashes.get(r.noteId) !== r.textHash)
    .map((r) => r.id);
  if (staleIds.length > 0) {
    await db.embeddings.bulkDelete(staleIds);
  }

  // Embed only notes that weren't loaded from cache
  for (const note of allNotes) {
    if (loadedNoteIds.has(note.id)) continue;
    try {
      await embedNote(note);
    } catch (err) {
      console.warn(`Failed to embed note "${note.title}":`, err);
    }
  }

  vectorStoreReady.set(true);

  // Subscribe to notes store for reactive re-embedding with debounce.
  // Skip the first synchronous emission (we just embedded everything above).
  let skipFirst = true;
  unsubscribe = notes.subscribe((currentNotes) => {
    if (skipFirst) {
      skipFirst = false;
      return;
    }
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      enqueueSyncNotes(currentNotes);
    }, 1500);
  });
}

/** Force a note to be re-embedded on the next sync (e.g. after moving to a different folder). */
export function forceReembed(noteId: string): void {
  contentHashes.delete(noteId);
}

/** Search for notes semantically. Returns empty array if store not ready. */
export async function searchNotes(query: string, topK: number = 5, folderId?: string | null): Promise<SearchResult[]> {
  if (!store || !worker) return [];

  let queryVectors: number[][];
  try {
    queryVectors = await embed([query]);
  } catch {
    return [];
  }

  const results = store.search(queryVectors[0], topK * 2); // over-fetch to allow dedup

  // Deduplicate by noteId, keeping highest score per note
  const noteMap = new Map<string, SearchResult>();
  const allNotes = get(notes);
  const noteById = new Map(allNotes.map((n) => [n.id, n]));

  for (const result of results) {
    const { noteId, chunkText: chunk } = result.entry;
    const existing = noteMap.get(noteId);
    if (!existing || result.score > existing.score) {
      const note = noteById.get(noteId);
      noteMap.set(noteId, {
        noteId,
        title: note?.title ?? noteId,
        chunkText: chunk,
        score: result.score,
      });
    }
  }

  // Soft folder boost: notes in the same folder get a small score bump
  if (folderId) {
    for (const result of noteMap.values()) {
      const note = noteById.get(result.noteId);
      if (note && (note.folderId ?? null) === folderId) {
        result.score += 0.03;
      }
    }
  }

  return Array.from(noteMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/** Clean up all state. Useful for testing. */
export function destroyVectorStore(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (worker) {
    worker.terminate();
    worker = null;
  }
  rejectAllPending(new Error('Vector store destroyed'));
  store = null;
  contentHashes.clear();
  requestCounter = 0;
  syncPromise = Promise.resolve();
  vectorStoreReady.set(false);
}
