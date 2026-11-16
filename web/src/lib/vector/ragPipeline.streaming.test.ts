import { describe, expect, it, vi, afterEach } from 'vitest';
import { queryOllama, type RAGConfig } from './ragPipeline';

afterEach(() => vi.unstubAllGlobals());
const config: RAGConfig = { ollamaUrl: 'http://stale.invalid:11434', model: 'stale-ollama-model', topK: 5 };
function response(chunks: string[]) {
  return new Response(new ReadableStream({ start(c) { const e = new TextEncoder(); for (const s of chunks) c.enqueue(e.encode(s)); c.close(); } }));
}
async function consume() { let result = ''; for await (const token of queryOllama('Answer', config)) result += token; return result; }

describe('client llama.cpp hub stream', () => {
  it('buffers split SSE tokens', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(['data: {"token":"Based', ' on"}\n\ndata: {"token":" notes"}\n\ndata: [DONE]\n\n'])));
    expect(await consume()).toBe('Based on notes');
  });
  it('ignores stale browser URL/model and only calls the same-origin hub', async () => {
    const f = vi.fn().mockResolvedValue(response(['data: {"token":"ok"}\n\ndata: [DONE]\n\n'])); vi.stubGlobal('fetch', f);
    expect(await consume()).toBe('ok');
    expect(f.mock.calls[0][0]).toBe('/api/llm/chat');
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ prompt: 'Answer' });
    expect(f.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it('parses a final token without trailing newline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(['data: {"token":"Final answer"}'])));
    expect(await consume()).toBe('Final answer');
  });
  it('surfaces backend errors instead of silently swallowing them', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(['data: {"error":"Backend unavailable"}\n\n'])));
    await expect(consume()).rejects.toThrow('Backend unavailable');
  });
});
