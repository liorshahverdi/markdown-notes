import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkOllamaHealth } from '$lib/vector/ragPipeline';
import { resolveOllamaBaseUrl } from '$lib/server/ollamaUrl';

export const GET: RequestHandler = async ({ url }) => {
  let ollamaUrl: string;
  try {
    ollamaUrl = resolveOllamaBaseUrl(url.searchParams.get('ollamaUrl') || undefined);
  } catch (err) {
    throw error(400, err instanceof Error ? err.message : 'Invalid Ollama URL');
  }
  const ok = await checkOllamaHealth(ollamaUrl);
  return json({ ok });
};
