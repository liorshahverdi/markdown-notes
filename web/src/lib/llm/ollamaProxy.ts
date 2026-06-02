/**
 * Client-side proxy wrappers that route Ollama calls through SvelteKit
 * server API routes instead of calling Ollama directly from the browser.
 */

import type { RAGConfig, ChatMessage } from '$lib/vector/ragPipeline';
import type { OllamaJSONConfig } from './ollama';

/**
 * Check Ollama health via server proxy.
 */
export async function proxyCheckHealth(ollamaUrl: string): Promise<boolean> {
  try {
    const params = new URLSearchParams({ ollamaUrl });
    const response = await fetch(`/api/ollama/health?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

/**
 * Stream a chat response from Ollama via server proxy.
 * Accepts either a messages array (new) or a prompt string (legacy).
 */
export async function* proxyQueryOllama(
  messagesOrPrompt: ChatMessage[] | string,
  config: RAGConfig,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const payload: Record<string, unknown> = {
    model: config.model,
    ollamaUrl: config.ollamaUrl,
    topK: config.topK,
  };
  if (Array.isArray(messagesOrPrompt)) {
    payload.messages = messagesOrPrompt;
  } else {
    payload.prompt = messagesOrPrompt;
  }

  const response = await fetch('/api/ollama/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Ollama proxy request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    // Keep the last potentially incomplete line in the buffer
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const payload = trimmed.slice(6);

      if (payload === '[DONE]') return;

      try {
        const parsed = JSON.parse(payload);
        if (parsed.error) {
          throw new Error(parsed.error);
        }
        if (parsed.token) {
          yield parsed.token;
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue; // skip malformed lines
        throw e;
      }
    }
  }
}

/**
 * Query Ollama for JSON output via server proxy.
 * Same interface as `queryOllamaJSON` from ollama.ts.
 */
export async function proxyQueryOllamaJSON<T>(
  prompt: string,
  config: OllamaJSONConfig,
  signal?: AbortSignal
): Promise<T | null> {
  try {
    const response = await fetch('/api/ollama/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        ollamaUrl: config.ollamaUrl,
        ollamaModel: config.ollamaModel,
      }),
      signal,
    });

    if (!response.ok) {
      console.warn('[OllamaProxy] JSON request failed:', response.status);
      return null;
    }

    const data = await response.json();
    return (data.result as T) ?? null;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      console.warn('[OllamaProxy] JSON request aborted');
    } else {
      console.warn('[OllamaProxy] JSON request failed:', e);
    }
    return null;
  }
}
