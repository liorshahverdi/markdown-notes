import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('$lib/server/database');
  vi.doUnmock('$lib/server/graph/graphStore');
  vi.doUnmock('$lib/server/graph/graphService');
  vi.doUnmock('$lib/server/notesFile');
});

describe('GET /api/graph/proposals context', () => {
  it('returns proposals with review context attached from the current graph', async () => {
    vi.resetModules();
    const notes = [{ id: 'n1', title: 'Work Tasks' }];
    const graph = { entities: [], relations: [] };
    const attachProposalContext = vi.fn((proposals: Array<{ id: string }>) => proposals.map((p) => ({ ...p, context: { merge: 'x' } })));
    vi.doMock('$lib/server/database', () => ({ getDb: () => ({}) }));
    vi.doMock('$lib/server/notesFile', () => ({ readNotes: () => notes, readFolders: () => [] }));
    vi.doMock('$lib/server/graph/graphStore', () => ({ readProposals: () => [{ id: 'p1', kind: 'merge' }] }));
    vi.doMock('$lib/server/graph/graphService', () => ({
      getUserGraph: vi.fn(() => graph),
      attachProposalContext,
      createUserRelation: vi.fn(),
    }));
    const route = await import('./+server');
    const response = await route.GET({
      url: new URL('http://x/api/graph/proposals?status=pending'),
      locals: { user: { id: 'u1', username: 't' } },
    } as unknown as Parameters<typeof route.GET>[0]);
    expect(await response.json()).toEqual({ proposals: [{ id: 'p1', kind: 'merge', context: { merge: 'x' } }] });
    expect(attachProposalContext).toHaveBeenCalledWith([{ id: 'p1', kind: 'merge' }], graph, notes);
  });
});
