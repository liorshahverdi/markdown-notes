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
            { id: 'message-0', noteId: '__global__', role: 'user', content: 'What does billing depend on?', timestamp: 0 },
            {
              id: 'message-1',
              noteId: '__global__',
              role: 'assistant',
              content: 'Billing depends on the Ledger.',
              timestamp: 1,
              sources: [
                { id: 'n1', noteId: 'n1', title: 'Payments', relevanceScore: 0.9, kind: 'note' },
                {
                  id: 'overlay:e1', noteId: 'n1', title: 'Billing depends_on Ledger', relevanceScore: 0.5, kind: 'graph-edge',
                  excerpt: 'Billing service depends on the Ledger',
                  edge: { id: 'overlay:e1', fromEntityId: 'a', toEntityId: 'b', type: 'depends_on', fromName: 'Billing', toName: 'Ledger', reviewState: 'auto' },
                },
              ],
              coverage: { noteCount: 1, graphEdgeCount: 1, hasEvidence: true },
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

describe('ChatPanel graph citations and answer feedback', () => {
  it('shows graph edges as readable paths and sends 👍 feedback for the answer', async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { render, waitFor, fireEvent, getByRole: _unused } = await import('@testing-library/svelte');
    const { default: ChatPanel } = await import('./ChatPanel.svelte');
    const onSourceClick = vi.fn();
    const view = render(ChatPanel, { onSourceClick });

    await waitFor(() => expect(view.getByTestId('assistant-message').textContent).toContain('Billing depends on the Ledger.'));
    const chip = view.getByRole('button', { name: /billing → depends on → ledger/i });
    expect(chip.textContent).toContain('unreviewed');

    await fireEvent.click(view.getByRole('button', { name: /answer was helpful/i }));
    const feedbackCall = fetchMock.mock.calls.find((call) => (call as unknown as [string])[0] === '/api/graph/feedback') as unknown as [string, RequestInit];
    expect(JSON.parse(String(feedbackCall[1].body))).toEqual({
      query: 'What does billing depend on?', noteId: 'n1', relationIds: ['overlay:e1'], helpful: true,
    });

    await fireEvent.click(chip);
    expect(onSourceClick).toHaveBeenCalledWith('n1');
    vi.unstubAllGlobals();
  });
});
