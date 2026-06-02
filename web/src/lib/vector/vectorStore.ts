export interface VectorEntry {
  id: string;        // noteId + chunk index
  noteId: string;
  chunkText: string;
  vector: number[];  // embedding vector
}

export class VectorStore {
  private entries: VectorEntry[] = [];

  add(entry: VectorEntry): void {
    this.entries.push(entry);
  }

  addBatch(entries: VectorEntry[]): void {
    this.entries.push(...entries);
  }

  delete(noteId: string): void {
    this.entries = this.entries.filter((e) => e.noteId !== noteId);
  }

  search(queryVector: number[], topK: number = 5): Array<{ entry: VectorEntry; score: number }> {
    const scored = this.entries.map((entry) => ({
      entry,
      score: cosineSimilarity(queryVector, entry.vector),
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK);
  }

  size(): number {
    return this.entries.length;
  }

  clear(): void {
    this.entries = [];
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;

  return dot / denom;
}

export function chunkText(text: string, maxTokens: number = 500): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];

  const maxChars = maxTokens * 4; // approximate: ~4 chars per token
  const overlapChars = 200; // ~50 token overlap between chunks

  // If text fits in a single chunk, return it
  if (trimmed.length <= maxChars) {
    return [trimmed];
  }

  // Split on paragraph boundaries first
  const paragraphs = trimmed.split(/\n\n+/);
  const rawChunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    const paraText = para.trim();
    if (paraText.length === 0) continue;

    if (currentChunk.length === 0) {
      currentChunk = paraText;
    } else if (currentChunk.length + paraText.length + 2 <= maxChars) {
      currentChunk += '\n\n' + paraText;
    } else {
      // Current chunk is full, push it
      if (currentChunk.length > 0) {
        rawChunks.push(currentChunk);
      }
      currentChunk = paraText;
    }

    // If a single paragraph exceeds maxChars, split on sentences
    while (currentChunk.length > maxChars) {
      const cutPoint = findSentenceBoundary(currentChunk, maxChars);
      rawChunks.push(currentChunk.slice(0, cutPoint).trim());
      currentChunk = currentChunk.slice(cutPoint).trim();
    }
  }

  if (currentChunk.trim().length > 0) {
    rawChunks.push(currentChunk.trim());
  }

  // Add overlap: prepend the tail of the previous chunk to each subsequent chunk
  if (rawChunks.length <= 1) return rawChunks;

  const chunks: string[] = [rawChunks[0]];
  for (let i = 1; i < rawChunks.length; i++) {
    const prev = rawChunks[i - 1];
    const overlapText = prev.slice(-overlapChars).trimStart();
    // Find a clean break point (paragraph or sentence boundary) in the overlap
    const newlineIdx = overlapText.indexOf('\n');
    const overlap = newlineIdx > 0 ? overlapText.slice(newlineIdx + 1) : overlapText;
    chunks.push(overlap + '\n\n' + rawChunks[i]);
  }

  return chunks;
}

function findSentenceBoundary(text: string, maxChars: number): number {
  // Look for sentence boundaries (. ! ?) before maxChars
  const region = text.slice(0, maxChars);
  const lastPeriod = Math.max(
    region.lastIndexOf('. '),
    region.lastIndexOf('! '),
    region.lastIndexOf('? ')
  );

  if (lastPeriod > maxChars * 0.3) {
    return lastPeriod + 2; // include the space after punctuation
  }

  // Fall back to space boundary
  const lastSpace = region.lastIndexOf(' ');
  if (lastSpace > maxChars * 0.3) {
    return lastSpace + 1;
  }

  // Hard cut
  return maxChars;
}
