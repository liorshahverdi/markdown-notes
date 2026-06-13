import { describe, expect, it, vi, afterEach } from 'vitest';
import { queryOllama, type ChatMessage } from './ragPipeline';

afterEach(() => {
  vi.restoreAllMocks();
});

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe('queryOllama streaming parser', () => {
  it('buffers partial JSON lines so streamed chat tokens are not dropped', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(streamFromChunks([
      '{"message":{"content":"Based"},"done":false}\n{"message"',
      ':{"content":" on"},"done":false}\n',
      '{"message":{"content":" the notes"},"done":false}\n{"done":true}\n',
    ]), { status: 200 })));

    const messages: ChatMessage[] = [{ role: 'user', content: 'What risks should I watch?' }];
    const tokens: string[] = [];
    for await (const token of queryOllama(messages, { ollamaUrl: 'http://localhost:11434', model: 'llama3.2:3b', topK: 5 })) {
      tokens.push(token);
    }

    expect(tokens.join('')).toBe('Based on the notes');
  });

  it('sends deterministic low-latency Ollama options for stable chat answers', async () => {
    const fetchMock = vi.fn(async () => new Response(streamFromChunks([
      '{"message":{"content":"ok"},"done":false}\n{"done":true}\n',
    ]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const messages: ChatMessage[] = [{ role: 'user', content: 'Answer quickly' }];
    for await (const _token of queryOllama(messages, { ollamaUrl: 'http://localhost:11434', model: 'llama3.2:3b', topK: 5 })) {
      // consume stream
    }

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    const [, init] = calls[0];
    const body = JSON.parse(String(init.body));
    expect(body.options).toMatchObject({ temperature: 0, num_predict: 512, num_ctx: 8192 });
    expect(body.keep_alive).toBe('10m');
  });

  it('parses a final buffered Ollama JSON line even when it has no trailing newline', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(streamFromChunks([
      '{"message":{"content":"Final answer"},"done":false}',
    ]), { status: 200 })));

    const messages: ChatMessage[] = [{ role: 'user', content: 'Answer' }];
    const tokens: string[] = [];
    for await (const token of queryOllama(messages, { ollamaUrl: 'http://localhost:11434', model: 'llama3.2:3b', topK: 5 })) {
      tokens.push(token);
    }

    expect(tokens.join('')).toBe('Final answer');
  });
});
