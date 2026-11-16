/** Same-origin llama.cpp client. Historical exported names are compatibility
 * aliases only: no Ollama endpoint, URL, model or credential is used.
 */
import type { RAGConfig, ChatMessage } from '$lib/vector/ragPipeline';
import type { OllamaJSONConfig } from './ollama';

export async function proxyCheckHealth(_legacyUrl?: string): Promise<boolean> {
  try {
    const response = await fetch('/api/llm/health', { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return false;
    return (await response.json()).ok === true;
  } catch { return false; }
}

export async function* proxyQueryOllama(input: ChatMessage[] | string, _config: RAGConfig, signal?: AbortSignal): AsyncGenerator<string> {
  signal?.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', abort, { once: true });
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch('/api/llm/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Array.isArray(input) ? { messages: input } : { prompt: input }), signal: controller.signal });
    if (!response.ok || !response.body) throw new Error(`llama.cpp proxy request failed: ${response.status}`);
    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split('\n'); buffer = lines.pop() || '';
      if (done && buffer) { lines.push(buffer); buffer = ''; }
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const text = line.slice(5).trim();
        if (text === '[DONE]') return;
        if (!text) continue;
        const event = JSON.parse(text);
        if (event.error) throw new Error(event.error);
        if (event.token) yield event.token;
      }
      if (done) return;
    }
  } finally {
    signal?.removeEventListener('abort', abort);
    controller.abort();
    if (reader) { try { await reader.cancel(); } catch {} reader.releaseLock?.(); }
  }
}

export async function proxyQueryOllamaJSON<T>(prompt: string, _config: OllamaJSONConfig, signal?: AbortSignal): Promise<T | null> {
  try {
    const response = await fetch('/api/llm/json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }), signal });
    if (!response.ok) { console.warn('[LlamaCppProxy] JSON request failed:', response.status); return null; }
    return (await response.json()).result ?? null;
  } catch (e) { if (!signal?.aborted) console.warn('[LlamaCppProxy] JSON request failed:', e); return null; }
}
