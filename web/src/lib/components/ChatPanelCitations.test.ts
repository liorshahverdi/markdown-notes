import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/stores/rag', () => ({
  ragConfig: { subscribe: vi.fn((fn: any) => { fn({ ollamaUrl: 'http://localhost:11434', model: 'llama3.2:3b', topK: 5 }); return () => {}; }) },
}));

vi.mock('$lib/vector/ragPipeline', () => ({
  buildRAGPrompt: vi.fn((q: string) => q),
  buildRAGMessages: vi.fn(() => []),
  extractRelevantExcerpt: vi.fn((content: string) => content),
  queryOllama: vi.fn(),
  checkOllamaHealth: vi.fn().mockResolvedValue(true),
}));

vi.mock('$lib/voice/speechRecognition', () => ({
  createSpeechRecognition: vi.fn(() => ({
    state: { isListening: false, transcript: '', interimTranscript: '', error: null, isSupported: true },
    start: vi.fn(),
    stop: vi.fn(),
    isSupported: () => true,
  })),
}));

vi.mock('$lib/db/index', () => ({
  db: {
    chatMessages: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          sortBy: vi.fn().mockResolvedValue([
            {
              id: 'message-1',
              noteId: '__global__',
              role: 'assistant',
              content: 'Ada answer',
              timestamp: 1,
              sources: [{ id: 'entity-ada', noteId: 'entity-ada', title: 'Ada Lovelace', relevanceScore: 1, kind: 'wiki-page', wikiPath: 'wiki/entities/ada-lovelace.md' }],
              coverage: 'strong',
              usedRawFallback: false,
            },
          ]),
          delete: vi.fn(),
        })),
      })),
      put: vi.fn(),
    },
  },
}));

describe('ChatPanel wiki citations', () => {
  it('renders wiki citation kind and coverage state for assistant messages', async () => {
    const { render, waitFor } = await import('@testing-library/svelte');
    const { default: ChatPanel } = await import('./ChatPanel.svelte');
    const { getByTestId } = render(ChatPanel);

    await waitFor(() => expect(getByTestId('assistant-message').textContent).toContain('Ada answer'));
    expect(getByTestId('assistant-message').textContent).toContain('Wiki coverage: strong');
    expect(getByTestId('assistant-message').textContent).toContain('wiki-page');
    expect(getByTestId('assistant-message').textContent).toContain('Ada Lovelace');
  });

  it('renders note-memory coverage objects without leaking [object Object]', async () => {
    const [{ readFileSync }, { resolve }] = await Promise.all([import('node:fs'), import('node:path')]);
    const source = readFileSync(resolve(process.cwd(), 'src/lib/components/ChatPanel.svelte'), 'utf-8');

    expect(source).toContain('Memory evidence:');
    expect(source).toContain('coverage.noteCount');
    expect(source).not.toContain('Wiki coverage: {msg.coverage}');
  });
});
