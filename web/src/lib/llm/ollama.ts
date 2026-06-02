/**
 * Ollama JSON extraction utility.
 * Routes requests through the server-side proxy so the browser
 * never calls Ollama directly (required for remote access).
 */

import { proxyQueryOllamaJSON } from './ollamaProxy';

export interface OllamaJSONConfig {
  ollamaUrl: string;
  ollamaModel: string;
}

/**
 * Query Ollama with a prompt and parse the response as JSON.
 * Delegates to the server-side proxy at /api/ollama/json.
 * Returns null on failure (timeout, parse error, etc.).
 */
export async function queryOllamaJSON<T>(
  prompt: string,
  config: OllamaJSONConfig,
  signal?: AbortSignal
): Promise<T | null> {
  return proxyQueryOllamaJSON<T>(prompt, config, signal);
}
