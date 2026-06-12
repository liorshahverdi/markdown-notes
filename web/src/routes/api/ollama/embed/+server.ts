import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveOllamaBaseUrl } from '$lib/server/ollamaUrl';
const DEFAULT_MODEL = 'nomic-embed-text';
const TIMEOUT_MS = 30_000;

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { input, model, ollamaUrl } = body as {
    input: string | string[];
    model?: string;
    ollamaUrl?: string;
  };

  if (!input) {
    throw error(400, 'Missing input');
  }

  let url: string;
  try {
    url = resolveOllamaBaseUrl(ollamaUrl);
  } catch (err) {
    throw error(400, err instanceof Error ? err.message : 'Invalid Ollama URL');
  }
  const embeddingModel = model || DEFAULT_MODEL;

  try {
    const response = await fetch(`${url}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: embeddingModel,
        input: Array.isArray(input) ? input : [input],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      throw error(502, `Ollama embed request failed: ${response.status}`);
    }

    const result = await response.json();
    return json({ embeddings: result.embeddings });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw error(504, 'Ollama embed request timed out');
    }
    throw e;
  }
};
