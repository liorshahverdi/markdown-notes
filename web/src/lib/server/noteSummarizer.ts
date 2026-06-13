/**
 * Background note summarizer — generates 2-3 sentence summaries via Ollama.
 * Non-blocking: note saves complete immediately, summary generates in background.
 * Graceful degradation: if Ollama is unavailable, summary stays null.
 */

import { updateNoteSummary } from './notesFile';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'qwen2.5:3b';
const TIMEOUT_MS = 30_000;

/** Debounce map: noteId -> timer, so rapid saves don't spam Ollama */
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

const SUMMARIZE_PROMPT = (title: string, content: string) =>
  `Summarize the following note in 2-3 concise sentences. Focus on the key topics, decisions, and facts. Do not add information not present in the note.\n\nNote: ${title}\n${content.slice(0, 8000)}`;

async function generateSummary(
  content: string,
  title: string,
  ollamaUrl: string = DEFAULT_OLLAMA_URL,
  model: string = DEFAULT_MODEL
): Promise<string | null> {
  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: SUMMARIZE_PROMPT(title, content),
        stream: false,
        keep_alive: -1,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) return null;

    const result = await response.json();
    const text = result.response?.trim();
    return text || null;
  } catch {
    // Ollama unavailable or timeout — graceful degradation
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
  ollamaUrl?: string,
  model?: string
): void {
  // Skip very short notes
  if (content.trim().length < 50) return;

  // Clear existing timer for this note
  const existing = pendingTimers.get(noteId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    pendingTimers.delete(noteId);
    const summary = await generateSummary(content, title, ollamaUrl, model);
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
