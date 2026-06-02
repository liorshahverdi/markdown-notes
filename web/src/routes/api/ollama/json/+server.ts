import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2:3b';
const DEFAULT_TIMEOUT_MS = 60_000;

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { prompt, ollamaUrl, ollamaModel } = body as {
    prompt: string;
    ollamaUrl?: string;
    ollamaModel?: string;
  };

  if (!prompt || typeof prompt !== 'string') {
    throw error(400, 'Missing or invalid prompt');
  }

  const url = ollamaUrl || DEFAULT_OLLAMA_URL;
  const model = ollamaModel || DEFAULT_MODEL;

  try {
    const response = await fetch(`${url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: 'json',
        keep_alive: -1,
      }),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw error(502, `Ollama request failed: ${response.status}`);
    }

    const result = await response.json();
    const text = result.response?.trim();
    if (!text) {
      return json({ result: null });
    }

    const parsed = JSON.parse(text);
    return json({ result: parsed });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw error(504, 'Ollama request timed out');
    }
    if (e instanceof SyntaxError) {
      return json({ result: null, error: 'Failed to parse JSON response' });
    }
    throw e;
  }
};
