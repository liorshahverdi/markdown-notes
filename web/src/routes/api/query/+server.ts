import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { join } from 'node:path';
import { getDb } from '$lib/server/database';
import { resolveOllamaBaseUrl } from '$lib/server/ollamaUrl';
import { queryOllama, checkOllamaHealth } from '$lib/vector/ragPipeline';
import { buildWikiFirstQueryContext } from '$lib/wiki/query/queryPipeline';

const DEFAULT_TOP_K = 5;
const DEFAULT_MODEL = 'llama3.2:3b';
const DEFAULT_USER_ID = 'user-1';

export const POST: RequestHandler = async ({ request, locals }) => {
  const body = await request.json();
  const { query, model, ollamaUrl } = body as { query: string; model?: string; ollamaUrl?: string };

  if (!query || typeof query !== 'string') {
    throw error(400, 'Missing or invalid query parameter');
  }

  let resolvedOllamaUrl: string;
  try {
    resolvedOllamaUrl = resolveOllamaBaseUrl(ollamaUrl);
  } catch (err) {
    throw error(400, err instanceof Error ? err.message : 'Invalid Ollama URL');
  }

  const isHealthy = await checkOllamaHealth(resolvedOllamaUrl);
  if (!isHealthy) {
    throw error(503, 'Ollama is not reachable. Make sure it is running.');
  }

  const queryContext = buildWikiFirstQueryContext({
    db: getDb(),
    userId: locals.user?.id ?? DEFAULT_USER_ID,
    baseDir: join(process.cwd(), 'data'),
    query,
    topK: DEFAULT_TOP_K,
  });

  const config = { ollamaUrl: resolvedOllamaUrl, model: model || DEFAULT_MODEL, topK: DEFAULT_TOP_K };

  try {
    let fullResponse = '';
    for await (const token of queryOllama(queryContext.messages, config)) {
      fullResponse += token;
    }

    return json({
      response: fullResponse,
      sources: queryContext.citations,
      citations: queryContext.citations,
      coverage: queryContext.coverage,
      usedRawFallback: queryContext.usedRawFallback,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return json({
      response: `Error querying Ollama: ${message}`,
      sources: queryContext.citations,
      citations: queryContext.citations,
      coverage: queryContext.coverage,
      usedRawFallback: queryContext.usedRawFallback,
    });
  }
};
