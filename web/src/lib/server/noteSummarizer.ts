/**
 * Background note summarizer — generates 2-3 sentence summaries via llama.cpp.
 * Non-blocking: note saves complete immediately, summary generates in background.
 * Graceful degradation: if Laguna is unavailable, summary stays null.
 */

import { updateNoteSummary } from './notesFile';
import { completeLlamaCpp } from './llamaCpp';

/** Debounce map: noteId -> timer, so rapid saves don't spam the backend. */
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

const SUMMARIZE_PROMPT = (title: string, content: string) =>
  `Summarize the following note in 2-3 concise sentences. Focus on the key topics, decisions, and facts. Do not add information not present in the note.\n\nNote: ${title}\n${content.slice(0, 8000)}`;

async function generateSummary(content: string, title: string): Promise<string | null> {
  try {
    return await completeLlamaCpp(SUMMARIZE_PROMPT(title, content)) || null;
  } catch {
    // llama.cpp unavailable or busy — note saves still succeed.
    return null;
  }
}

/**
 * Trigger async summary generation for a note.
 * Debounced: waits 2s after the last call for the same noteId before generating.
 */
export function triggerSummaryGeneration(
  userId: string,
  noteId: string,
  title: string,
  content: string,
  _legacyUrl?: string,
  _legacyModel?: string
): void {
  // Skip very short notes
  if (content.trim().length < 50) return;

  // Clear existing timer for this note
  const existing = pendingTimers.get(noteId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    pendingTimers.delete(noteId);
    const summary = await generateSummary(content, title);
    if (summary) {
      try {
        updateNoteSummary(userId, noteId, summary);
      } catch {
        // DB write failed — not critical
      }
    }
  }, 2000);

  pendingTimers.set(noteId, timer);
}
