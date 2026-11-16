import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkLlamaCppHealth, completeLlamaCpp, queryLlamaCpp } from './llamaCpp';

const encoder = new TextEncoder();
function stream(parts: string[]) {
  return new Response(new ReadableStream({ start(c) { for (const p of parts) c.enqueue(encoder.encode(p)); c.close(); } }));
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function setup() { vi.stubEnv('LLAMACPP_API_KEY', 'test-secret'); vi.stubEnv('LLAMACPP_BASE_URL', 'http://127.0.0.1:8089/v1'); vi.stubEnv('LLAMACPP_MODEL', 'laguna-xs-2.1-q4_k_m'); }

describe('server llama.cpp boundary', () => {
  it('uses server credentials/config, parses split SSE and excludes reasoning', async () => {
    setup();
    const fetchMock = vi.fn().mockResolvedValue(stream([
      'data: {"choices":[{"delta":{"reasoning_content":"private thought"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Hel',
      'lo"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
    ]));
    vi.stubGlobal('fetch', fetchMock);
    const tokens = [];
    for await (const token of queryLlamaCpp('Hi', { ollamaUrl: 'http://attacker.invalid', model: 'wrong', topK: 3 })) tokens.push(token);
    expect(tokens.join('')).toBe('Hello world');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:8089/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer test-secret');
    expect(JSON.parse(init.body)).toMatchObject({ model: 'laguna-xs-2.1-q4_k_m', messages: [{ role: 'user', content: 'Hi' }], stream: true, cache_prompt: false, chat_template_kwargs: { enable_thinking: false } });
    expect(init.signal.aborted).toBe(true);
  });
  it('handles structured nonstreaming content', async () => {
    setup(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: '{"ok":true}' } }] })));
    expect(await completeLlamaCpp('Return JSON', { json: true })).toBe('{"ok":true}');
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string).response_format).toEqual({ type: 'json_object' });
  });
  it('reports backend failures without leaking credentials', async () => {
    setup(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('test-secret', { status: 401 })));
    await expect(completeLlamaCpp('Hi')).rejects.toThrow('llama.cpp request failed: 401');
  });
  it('health requires the configured model, not just any running backend', async () => {
    setup(); const f = vi.fn().mockResolvedValueOnce(Response.json({ data: [{ id: 'other' }] })).mockResolvedValueOnce(Response.json({ data: [{ id: 'laguna-xs-2.1-q4_k_m' }] })); vi.stubGlobal('fetch', f);
    expect(await checkLlamaCppHealth()).toBe(false); expect(await checkLlamaCppHealth()).toBe(true);
  });
  it('does not start a request when already cancelled', async () => {
    setup(); const f = vi.fn(); vi.stubGlobal('fetch', f); const c = new AbortController(); c.abort();
    await expect(async () => { for await (const token of queryLlamaCpp('Hi', undefined, c.signal)) void token; }).rejects.toThrow();
    expect(f).not.toHaveBeenCalled();
  });
  it('rejects nonloopback configuration and missing credentials', async () => {
    setup(); vi.stubEnv('LLAMACPP_BASE_URL', 'http://attacker.invalid/v1');
    await expect(completeLlamaCpp('Hi')).rejects.toThrow('loopback');
    vi.stubEnv('LLAMACPP_BASE_URL', 'http://127.0.0.1:8089/v1'); vi.stubEnv('LLAMACPP_API_KEY', '');
    await expect(completeLlamaCpp('Hi')).rejects.toThrow('LLAMACPP_API_KEY');
  });
});
