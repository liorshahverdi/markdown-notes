/**
 * Server-side embedding pipeline.
 * Prefers Ollama's nomic-embed-text for higher quality embeddings (768-dim).
 * Falls back to @xenova/transformers all-MiniLM-L6-v2 (384-dim) if Ollama is unavailable.
 */

import { cosineSimilarity, chunkText } from './vectorStore';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_EMBEDDING_MODEL = 'nomic-embed-text';
const EMBED_TIMEOUT_MS = 30_000;

// Xenova fallback state
let xenovaPipeline: any = null;
let xenovaLoadPromise: Promise<void> | null = null;

/** Whether Ollama embed is available (stays true until first failure) */
let ollamaEmbedAvailable = true;

async function loadXenovaModel(): Promise<void> {
  if (xenovaPipeline) return;
  if (xenovaLoadPromise) return xenovaLoadPromise;

  xenovaLoadPromise = (async () => {
    const { pipeline: createPipeline } = await import('@xenova/transformers');
    xenovaPipeline = await createPipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  })();

  return xenovaLoadPromise;
}

async function embedViaXenova(text: string): Promise<number[]> {
  if (!xenovaPipeline) await loadXenovaModel();
  const output = await xenovaPipeline(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data) as number[];
}

async function embedViaOllama(texts: string[], ollamaUrl: string = DEFAULT_OLLAMA_URL, model: string = DEFAULT_EMBEDDING_MODEL): Promise<number[][]> {
  const response = await fetch(`${ollamaUrl}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      input: texts,
    }),
    signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Ollama embed failed: ${response.status}`);
  }

  const result = await response.json();
  return result.embeddings;
}

/** Embed a single text string, returning its vector */
export async function embedText(text: string): Promise<number[]> {
  if (ollamaEmbedAvailable) {
    try {
      const [vector] = await embedViaOllama([text]);
      return vector;
    } catch {
      console.warn('[ServerEmbeddings] Ollama embed unavailable, falling back to Xenova');
      ollamaEmbedAvailable = false;
    }
  }
  return embedViaXenova(text);
}

/** Embed multiple texts in batch (Ollama supports batching) */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (ollamaEmbedAvailable) {
    try {
      return await embedViaOllama(texts);
    } catch {
      console.warn('[ServerEmbeddings] Ollama embed unavailable, falling back to Xenova');
      ollamaEmbedAvailable = false;
    }
  }
  // Xenova fallback: embed one at a time
  const vectors: number[][] = [];
  for (const text of texts) {
    vectors.push(await embedViaXenova(text));
  }
  return vectors;
}

interface NoteInput {
  id: string;
  title: string;
  content: string;
}

interface ServerSearchResult {
  noteId: string;
  title: string;
  score: number;
}

/**
 * Semantic search over notes server-side.
 * Chunks all notes, embeds them, and finds the best matches for the query.
 *
 * Caches note embeddings in memory across requests so re-embedding is
 * only needed when notes change (keyed by note ID + content length as a
 * simple staleness check).
 */
const embeddingCache = new Map<string, { chunks: string[]; vectors: number[][] }>();

/** Simple hash for cache invalidation — uses djb2 algorithm for speed. */
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function cacheKey(note: NoteInput): string {
  return `${note.id}:${simpleHash(note.content)}`;
}

export async function serverSemanticSearch(
  query: string,
  notes: NoteInput[],
  topK: number = 5
): Promise<{ results: ServerSearchResult[]; contextNotes: Array<{ title: string; content: string }> }> {
  // Embed query
  const queryVector = await embedText(query);

  // Build per-chunk scores
  const scored: Array<{ noteId: string; title: string; score: number }> = [];

  for (const note of notes) {
    const key = cacheKey(note);
    let chunks: string[];
    let vectors: number[][];

    const cached = embeddingCache.get(key);
    if (cached) {
      chunks = cached.chunks;
      vectors = cached.vectors;
    } else {
      const text = `${note.title}\n\n${note.content}`;
      chunks = chunkText(text);
      if (chunks.length === 0) continue;

      vectors = await embedBatch(chunks);
      embeddingCache.set(key, { chunks, vectors });
    }

    // Best chunk score for this note
    let bestScore = -1;
    for (const vec of vectors) {
      const sim = cosineSimilarity(queryVector, vec);
      if (sim > bestScore) bestScore = sim;
    }

    if (bestScore > 0) {
      scored.push({ noteId: note.id, title: note.title, score: bestScore });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const topResults = scored.slice(0, topK);

  const noteById = new Map(notes.map((n) => [n.id, n]));
  const contextNotes = topResults.map((r) => {
    const note = noteById.get(r.noteId)!;
    return { title: note.title, content: note.content };
  });

  return {
    results: topResults.map((r) => ({
      noteId: r.noteId,
      title: r.title,
      score: r.score,
    })),
    contextNotes,
  };
}
