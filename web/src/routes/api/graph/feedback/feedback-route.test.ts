import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('$lib/server/database');
  vi.doUnmock('$lib/server/graph/graphService');
});

async function post(body: unknown) {
  vi.resetModules();
  const recordAnswerFeedback = vi.fn(() => ({ evalAdded: false, edgesCredited: 1 }));
  vi.doMock('$lib/server/database', () => ({ getDb: () => ({}) }));
  vi.doMock('$lib/server/graph/graphService', () => ({ recordAnswerFeedback }));
  const route = await import('./+server');
  await route.POST({
    request: new Request('http://x/api/graph/feedback', { method: 'POST', body: JSON.stringify(body) }),
    locals: { user: { id: 'u1', username: 't' } },
  } as unknown as Parameters<typeof route.POST>[0]);
  return recordAnswerFeedback;
}

describe('POST /api/graph/feedback', () => {
  it('passes a thumbs-down through as unhelpful', async () => {
    const record = await post({ query: 'q', noteId: 'n1', relationIds: ['e1'], helpful: false });
    expect(record).toHaveBeenCalledWith(expect.anything(), 'u1', { query: 'q', noteId: 'n1', relationIds: ['e1'], helpful: false });
  });

  it('treats feedback as helpful unless it says otherwise', async () => {
    const record = await post({ noteId: 'n1' });
    expect(record).toHaveBeenCalledWith(expect.anything(), 'u1', expect.objectContaining({ helpful: true }));
  });
});
