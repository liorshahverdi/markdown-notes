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
            { id: 'message-user', noteId: '__global__', role: 'user', content: 'What did Ada contribute?', timestamp: 1 },
            {
              id: 'message-answer',
              noteId: '__global__',
              role: 'assistant',
              content: 'Ada described symbolic operations.',
              timestamp: 2,
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

describe('ChatPanel file answer affordance', () => {
  it('renders a file-to-wiki action for assistant answers with citations', async () => {
    const { render, waitFor } = await import('@testing-library/svelte');
    const { default: ChatPanel } = await import('./ChatPanel.svelte');
    const { getByRole } = render(ChatPanel);

    await waitFor(() => expect(getByRole('button', { name: 'File answer to wiki' })).toBeTruthy());
  });
});
