import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getModelLease } from '$lib/server/modelLease';
import { completeLlamaCpp } from '$lib/server/llamaCpp';

export const POST: RequestHandler = async ({ request }) => {
  const { prompt } = await request.json();
  getModelLease().touch();
  if (typeof prompt !== 'string' || !prompt.trim()) throw error(400, 'Missing or invalid prompt');
  try {
    const text = await completeLlamaCpp(prompt, { json: true, signal: request.signal });
    return json({ result: text ? JSON.parse(text) : null });
  } catch (e) {
    if (e instanceof SyntaxError) return json({ result: null, error: 'Failed to parse JSON response' });
    if (e instanceof DOMException && ['TimeoutError', 'AbortError'].includes(e.name)) throw error(504, 'llama.cpp request timed out or cancelled');
    throw error(502, e instanceof Error ? e.message : 'llama.cpp request failed');
  }
};
