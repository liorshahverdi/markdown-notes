import { describe, expect, it, vi } from 'vitest';
import type { GraphRelationReviewMap } from '$lib/graph/relationReviewKey';

async function loadRouteWithMocks(relationReviews: GraphRelationReviewMap) {
  vi.resetModules();
  const buildNoteMemoryContext = vi.fn(() => ({
    messages: [],
    citations: [],
    graphEvidence: [],
    retrievalMode: 'notes-graph',
    usedWikiContext: false,
    coverage: { noteCount: 0, graphEdgeCount: 0, hasEvidence: false },
  }));

  vi.doMock('$lib/server/database', () => ({ getDb: () => ({ id: 'db' }) }));
  vi.doMock('$lib/server/dataDir', () => ({ getDataDir: () => '/tmp/mdnotes-test' }));
  vi.doMock('$lib/server/ollamaUrl', () => ({ resolveOllamaBaseUrl: () => 'http://localhost:11434' }));
  vi.doMock('$lib/server/notesFile', () => ({
    readNotes: () => [{ id: 'n1', title: 'Alpha', content: 'Alpha depends on Beta.', dateModified: 1, isPinned: false }],
    readFolders: () => [],
  }));
  vi.doMock('$lib/server/graphRelationReviews', () => ({
    readGraphRelationReviews: vi.fn(() => relationReviews),
  }));
  vi.doMock('$lib/memory/noteMemoryPipeline', () => ({ buildNoteMemoryContext }));
  vi.doMock('$lib/memory/answerSynthesizer', () => ({
    synthesizeAnswerFromMemory: () => ({ confidence: 'high', answer: 'grounded answer' }),
  }));
  vi.doMock('$lib/memory/localMemoryIndex', () => ({
    searchLocalMemory: vi.fn(async () => []),
    ensureUserMemoryIndex: vi.fn(async () => undefined),
  }));
  vi.doMock('$lib/wiki/query/queryPipeline', () => ({ buildWikiFirstQueryContext: vi.fn() }));
  vi.doMock('$lib/vector/ragPipeline', () => ({ queryOllama: vi.fn() }));

  const route = await import('./+server');
  return { route, buildNoteMemoryContext };
}

describe('/api/query graph relation reviews', () => {
  it('passes persisted user graph review state into default notes+graph retrieval', async () => {
    const relationReviews: GraphRelationReviewMap = new Map([
      ['depends_on:alpha->beta', { reviewKey: 'depends_on:alpha->beta', rejected: true, accepted: false }],
    ]);
    const { route, buildNoteMemoryContext } = await loadRouteWithMocks(relationReviews);

    const response = await route.POST({
      request: new Request('http://localhost/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Alpha Beta', stream: false }),
      }),
      locals: { user: { id: 'user-1', username: 'tester' } },
    } as Parameters<typeof route.POST>[0]);

    expect(response.status).toBe(200);
    expect(buildNoteMemoryContext).toHaveBeenCalledWith(expect.objectContaining({ relationReviews }));
  });
});
