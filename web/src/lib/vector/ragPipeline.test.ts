import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRAGPrompt, checkOllamaHealth, ragQuery, extractRelevantExcerpt, MAX_PROMPT_CHARS, type RAGConfig } from './ragPipeline';
import { VectorStore } from './vectorStore';

describe('buildRAGPrompt', () => {
  it('should include the query', () => {
    const prompt = buildRAGPrompt('What is TDD?', []);
    expect(prompt).toContain('What is TDD?');
  });

  it('should include note titles and content', () => {
    const prompt = buildRAGPrompt('query', [
      { title: 'Note A', content: 'Content of note A' },
      { title: 'Note B', content: 'Content of note B' },
    ]);
    expect(prompt).toContain('Note A');
    expect(prompt).toContain('Content of note A');
    expect(prompt).toContain('Note B');
    expect(prompt).toContain('Content of note B');
  });

  it('should format with separators between notes', () => {
    const prompt = buildRAGPrompt('query', [
      { title: 'Note A', content: 'AAA' },
      { title: 'Note B', content: 'BBB' },
    ]);
    expect(prompt).toContain('---');
  });

  it('should include instruction prefix', () => {
    const prompt = buildRAGPrompt('What is X?', [{ title: 'T', content: 'C' }]);
    expect(prompt).toContain('User question: What is X?');
    expect(prompt).toContain('Relevant notes');
  });

  it('should handle empty context notes', () => {
    const prompt = buildRAGPrompt('What is X?', []);
    expect(prompt).toContain('What is X?');
  });

  it('should truncate when notes exceed MAX_PROMPT_CHARS', () => {
    const bigContent = 'A'.repeat(3000);
    const notes = [
      { title: 'Note 1', content: bigContent },
      { title: 'Note 2', content: bigContent },
    ];
    const prompt = buildRAGPrompt('query', notes);
    expect(prompt.length).toBeLessThanOrEqual(MAX_PROMPT_CHARS + 50); // small overflow for truncation marker
  });

  it('should include excerpts from all notes when possible and stay within cap', () => {
    const notes = [
      { title: 'First', content: 'A'.repeat(6000) },
      { title: 'Second', content: 'B'.repeat(6000) },
      { title: 'Third', content: 'C'.repeat(6000) },
    ];
    const prompt = buildRAGPrompt('query', notes);
    expect(prompt).toContain('First');
    expect(prompt).toContain('Second');
    expect(prompt).toContain('Third');
    expect(prompt.length).toBeLessThanOrEqual(MAX_PROMPT_CHARS + 50);
  });
});

describe('extractRelevantExcerpt', () => {
  it('should return top-scoring paragraphs within limit', () => {
    const content = [
      'The weather is nice today in the park.',
      'Rust is a systems programming language.',
      'I went to the store for groceries.',
      'Rust provides memory safety without garbage collection.',
    ].join('\n\n');

    const result = extractRelevantExcerpt(content, 'Rust programming', 200);
    expect(result).toContain('Rust');
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it('should return content unchanged when shorter than limit', () => {
    const content = 'Short note content.';
    const result = extractRelevantExcerpt(content, 'anything', 2000);
    expect(result).toBe(content);
  });

  it('should handle content with no query term matches', () => {
    const content = 'A'.repeat(3000);
    const result = extractRelevantExcerpt(content, 'xyz', 500);
    expect(result.length).toBeLessThanOrEqual(500);
  });
});

describe('checkOllamaHealth', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return true when Ollama is reachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const result = await checkOllamaHealth('http://localhost:11434');
    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/tags', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('should return false when Ollama is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const result = await checkOllamaHealth('http://localhost:11434');
    expect(result).toBe(false);
  });

  it('should return false on non-200 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const result = await checkOllamaHealth('http://localhost:11434');
    expect(result).toBe(false);
  });
});

describe('ragQuery', () => {
  let store: VectorStore;
  const config: RAGConfig = {
    ollamaUrl: 'http://localhost:11434',
    model: 'llama3',
    topK: 3,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    store = new VectorStore();
    store.addBatch([
      { id: 'n1-0', noteId: 'n1', chunkText: 'TDD is test-driven development', vector: [1, 0, 0] },
      { id: 'n2-0', noteId: 'n2', chunkText: 'Svelte is a frontend framework', vector: [0, 1, 0] },
      { id: 'n3-0', noteId: 'n3', chunkText: 'Rust is a systems language', vector: [0, 0, 1] },
    ]);
  });

  it('should search the vector store and return source notes', async () => {
    // Mock fetch to return a streaming response
    const mockResponse = {
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(JSON.stringify({ response: 'TDD is great' }) + '\n'),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(JSON.stringify({ response: '', done: true }) + '\n'),
            })
            .mockResolvedValueOnce({ done: true, value: undefined }),
        }),
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    const result = await ragQuery('What is TDD?', [1, 0, 0], store, config);

    expect(result.sourceNotes.length).toBeGreaterThan(0);
    expect(result.sourceNotes[0].noteId).toBe('n1');
    expect(result.response).toContain('TDD is great');
  });

  it('should return error result when Ollama call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));

    const result = await ragQuery('What is TDD?', [1, 0, 0], store, config);

    expect(result.response).toContain('Error');
    expect(result.sourceNotes.length).toBeGreaterThan(0); // sources still found
  });

  it('should handle empty vector store', async () => {
    const emptyStore = new VectorStore();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body: null }));

    const result = await ragQuery('query', [1, 0, 0], emptyStore, config);

    expect(result.sourceNotes).toHaveLength(0);
    expect(result.response).toContain('No relevant notes found');
  });

  it('should deduplicate notes when multiple chunks match from same note', async () => {
    store.add({ id: 'n1-1', noteId: 'n1', chunkText: 'More TDD content', vector: [0.9, 0.1, 0] });

    const mockResponse = {
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(JSON.stringify({ response: 'Answer', done: true }) + '\n'),
            })
            .mockResolvedValueOnce({ done: true, value: undefined }),
        }),
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    const result = await ragQuery('TDD', [1, 0, 0], store, config);

    // Should only have unique noteIds in sources
    const noteIds = result.sourceNotes.map((s) => s.noteId);
    expect(new Set(noteIds).size).toBe(noteIds.length);
  });
});
