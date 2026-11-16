import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.doUnmock('$lib/server/database'));
afterEach(() => vi.doUnmock('$lib/server/graph/graphStore'));

describe('GET /api/graph/proposals', () => {
  it('filters by note and status', async () => {
    vi.resetModules();
    const readProposals = vi.fn(() => []);
    vi.doMock('$lib/server/database', () => ({ getDb: () => ({}) }));
    vi.doMock('$lib/server/graph/graphStore', () => ({ readProposals }));
    const route = await import('./+server');
    await route.GET({
      url: new URL('http://x/api/graph/proposals?noteId=n1&status=pending'),
      locals: { user: { id: 'u1', username: 't' } },
    } as unknown as Parameters<typeof route.GET>[0]);
    expect(readProposals).toHaveBeenCalledWith(expect.anything(), 'u1', expect.objectContaining({ noteId: 'n1', status: ['pending'] }));
  });
});
