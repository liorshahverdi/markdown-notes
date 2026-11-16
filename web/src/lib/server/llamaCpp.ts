import type { ChatMessage, RAGConfig } from '../vector/ragPipeline';

export const DEFAULT_LLAMACPP_MODEL = 'laguna-xs-2.1-q4_k_m';
export const DEFAULT_LLAMACPP_BASE_URL = 'http://127.0.0.1:8089/v1';

/** Configuration and credentials belong to the hub, never a remote browser. */
function backend() {
  const url = new URL(process.env.LLAMACPP_BASE_URL || DEFAULT_LLAMACPP_BASE_URL);
  if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash) {
    throw new Error('LLAMACPP_BASE_URL must be an HTTP(S) loopback URL');
  }
  const key = process.env.LLAMACPP_API_KEY;
  if (!key) throw new Error('LLAMACPP_API_KEY is not configured on the hub');
  return { url: url.toString().replace(/\/$/, ''), model: process.env.LLAMACPP_MODEL || DEFAULT_LLAMACPP_MODEL,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` } };
}
function payload(input: ChatMessage[] | string, model: string, stream: boolean) {
  return { model, messages: typeof input === 'string' ? [{ role: 'user', content: input }] : input,
    stream, temperature: 0, max_tokens: 2048, cache_prompt: false, chat_template_kwargs: { enable_thinking: false } };
}
export async function checkLlamaCppHealth(): Promise<boolean> {
  try {
    const b = backend();
    const r = await fetch(`${b.url}/models`, { headers: b.headers, signal: AbortSignal.timeout(3000) });
    if (!r.ok) return false;
    const data = await r.json();
    return Array.isArray(data.data) && data.data.some((m: { id: string }) => m.id === b.model);
  } catch { return false; }
}
export async function completeLlamaCpp(input: ChatMessage[] | string, options: { json?: boolean; signal?: AbortSignal; timeoutMs?: number } = {}): Promise<string> {
  const b = backend();
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 180_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const r = await fetch(`${b.url}/chat/completions`, { method: 'POST', headers: b.headers,
    body: JSON.stringify({ ...payload(input, b.model, false), ...(options.json ? { response_format: { type: 'json_object' } } : {}) }), signal });
  if (!r.ok) throw new Error(`llama.cpp request failed: ${r.status}`);
  const data = await r.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

/** Streams OpenAI SSE, not Ollama NDJSON. Legacy config is ignored during migration. */
export async function* queryLlamaCpp(input: ChatMessage[] | string, _legacyConfig?: RAGConfig, signal?: AbortSignal, fetchTimeoutMs = 180_000, readTimeoutMs = 120_000): AsyncGenerator<string> {
  signal?.throwIfAborted();
  const b = backend();
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', abort, { once: true });
  const fetchTimer = setTimeout(() => controller.abort(new Error('llama.cpp connection timed out')), fetchTimeoutMs);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const r = await fetch(`${b.url}/chat/completions`, { method: 'POST', headers: b.headers,
      body: JSON.stringify(payload(input, b.model, true)), signal: controller.signal });
    clearTimeout(fetchTimer);
    if (!r.ok || !r.body) throw new Error(`llama.cpp request failed: ${r.status}`);
    reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    function parse(line: string): { token?: string; done?: boolean } {
      if (!line.startsWith('data:')) return {};
      const text = line.slice(5).trim();
      if (text === '[DONE]') return { done: true };
      if (!text) return {};
      const data = JSON.parse(text);
      if (data.error) throw new Error('llama.cpp stream returned an error');
      const choice = data.choices?.[0];
      return { token: choice?.delta?.content || '', done: Boolean(choice?.finish_reason) };
    }
    while (true) {
      controller.signal.throwIfAborted();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let onAbort: (() => void) | undefined;
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await Promise.race([reader.read(), new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('llama.cpp stream stalled')), readTimeoutMs);
          onAbort = () => reject(controller.signal.reason);
          controller.signal.addEventListener('abort', onAbort, { once: true });
        })]);
      } finally {
        if (timer) clearTimeout(timer);
        if (onAbort) controller.signal.removeEventListener('abort', onAbort);
      }
      buffer += chunk.done ? decoder.decode() : decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split('\n'); buffer = lines.pop() || '';
      if (chunk.done && buffer) { lines.push(buffer); buffer = ''; }
      for (const line of lines) {
        const event = parse(line.replace(/\r$/, ''));
        if (event.token) yield event.token;
        if (event.done) return;
      }
      if (chunk.done) break;
    }
  } finally {
    clearTimeout(fetchTimer);
    signal?.removeEventListener('abort', abort);
    controller.abort();
    if (reader) { try { await reader.cancel(); } catch {} reader.releaseLock(); }
  }
}
