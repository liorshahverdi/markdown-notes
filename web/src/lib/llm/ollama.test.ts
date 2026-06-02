import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryOllamaJSON } from './ollama';

describe('queryOllamaJSON', () => {
  const mockConfig = {
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3.2:3b',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parses a valid JSON response from the proxy', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        result: { answer: 42, items: ['a', 'b'] },
      }),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any);

    const result = await queryOllamaJSON<{ answer: number; items: string[] }>(
      'test prompt',
      mockConfig
    );

    expect(result).toEqual({ answer: 42, items: ['a', 'b'] });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/ollama/json',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"prompt"'),
      })
    );
  });

  it('returns null for non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
    } as any);

    const result = await queryOllamaJSON('test', mockConfig);
    expect(result).toBeNull();
  });

  it('returns null when proxy returns null result', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ result: null }),
    } as any);

    const result = await queryOllamaJSON('test', mockConfig);
    expect(result).toBeNull();
  });

  it('returns null on fetch error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const result = await queryOllamaJSON('test', mockConfig);
    expect(result).toBeNull();
  });

  it('sends ollamaUrl and ollamaModel in the request body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ result: {} }),
    } as any);

    await queryOllamaJSON('test', mockConfig);

    const [, fetchOptions] = (globalThis.fetch as any).mock.calls[0];
    const body = JSON.parse(fetchOptions.body);
    expect(body.ollamaUrl).toBe('http://localhost:11434');
    expect(body.ollamaModel).toBe('llama3.2:3b');
    expect(body.prompt).toBe('test');
  });

  it('respects abort signal', async () => {
    const controller = new AbortController();
    controller.abort();

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new DOMException('Aborted', 'AbortError')
    );

    const result = await queryOllamaJSON('test', mockConfig, controller.signal);
    expect(result).toBeNull();
  });
});
