import { writable, get } from 'svelte/store';
import { notes } from '../stores/notes';
import { extractRelevantExcerpt } from './ragPipeline';

export interface SearchResult {
  noteId: string;
  title: string;
  chunkText: string;
  score: number;
}

// Public names retained for callers; retrieval no longer loads neural models.
export const vectorStoreReady = writable(false);
export async function initVectorStore(): Promise<void> { vectorStoreReady.set(true); }
export function destroyVectorStore(): void { vectorStoreReady.set(false); }
export function forceReembed(_noteId: string): void { /* No embedding index to invalidate. */ }

/** Deterministic keyword search. Stored IndexedDB embeddings are left untouched. */
export async function searchNotes(query: string, topK = 5, folderId?: string | null): Promise<SearchResult[]> {
  if (!get(vectorStoreReady)) return [];
  const terms = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}_]+/gu) || [])];
  if (!terms.length) return [];
  return get(notes).flatMap(note => {
    const title = note.title.toLowerCase();
    const content = note.content.toLowerCase();
    let matches = 0;
    let titleMatches = 0;
    for (const term of terms) {
      if (title.includes(term) || content.includes(term)) matches++;
      if (title.includes(term)) titleMatches++;
    }
    if (!matches) return [];
    const score = matches / terms.length + titleMatches / terms.length + (folderId && note.folderId === folderId ? 0.03 : 0);
    return [{ noteId: note.id, title: note.title, chunkText: extractRelevantExcerpt(note.content, query), score }];
  }).sort((a, b) => b.score - a.score || a.noteId.localeCompare(b.noteId)).slice(0, Math.max(0, topK));
}
