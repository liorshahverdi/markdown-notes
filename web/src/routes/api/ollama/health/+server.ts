import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkOllamaHealth } from '$lib/vector/ragPipeline';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

export const GET: RequestHandler = async ({ url }) => {
  const ollamaUrl = url.searchParams.get('ollamaUrl') || DEFAULT_OLLAMA_URL;
  const ok = await checkOllamaHealth(ollamaUrl);
  return json({ ok });
};
