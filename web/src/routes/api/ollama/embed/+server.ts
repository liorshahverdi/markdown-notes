import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Laguna is a chat model. Existing clients must fall back to their local embedding worker.
export const POST: RequestHandler = async () => {
  throw error(410, 'Ollama embeddings were retired. Use the local Xenova embedding pipeline; Laguna does not provide embeddings.');
};
