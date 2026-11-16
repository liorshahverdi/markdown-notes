import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('$lib/server/modelLease');
  vi.doUnmock('$lib/server/graph/graphWorker');
});

async function loadRoute(restartResult: { phase: string }) {
  vi.resetModules();
  const enqueueGraphUpdate = vi.fn();
  let finish!: () => void;
  const done = new Promise<void>((resolve) => (finish = resolve));
  vi.doMock('$lib/server/modelLease', () => ({
    getModelLease: () => ({
      snapshot: () => ({ phase: 'acquiring' }),
      residentPeers: async () => [],
      restart: async () => {
        await done;
        return restartResult;
      },
    }),
  }));
  vi.doMock('$lib/server/graph/graphWorker', () => ({ enqueueGraphUpdate }));
  const route = await import('./+server');
  const post = () =>
    route.POST({
      locals: { user: { id: 'user-1', username: 't' }, auth: { type: 'session' } },
      request: new Request('http://x/api/llm/lease', { method: 'POST', body: JSON.stringify({ action: 'restart' }) }),
    } as unknown as Parameters<typeof route.POST>[0]);
  return { post, finish, enqueueGraphUpdate };
}

describe('POST /api/llm/lease restart', () => {
  it('queues a graph pass once Laguna is actually held, so skipped model work resumes', async () => {
    const { post, finish, enqueueGraphUpdate } = await loadRoute({ phase: 'held' });
    const response = await post();
    expect(response.status).toBe(202);
    expect(enqueueGraphUpdate).not.toHaveBeenCalled();
    finish();
    await vi.waitFor(() => expect(enqueueGraphUpdate).toHaveBeenCalledWith('user-1', 'model-ready'));
  });

  it('does not queue a pass when acquiring the lease fails', async () => {
    const { post, finish, enqueueGraphUpdate } = await loadRoute({ phase: 'error' });
    await post();
    finish();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(enqueueGraphUpdate).not.toHaveBeenCalled();
  });
});
