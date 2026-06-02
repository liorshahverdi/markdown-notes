import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.fn();
const prepareMock = vi.fn(() => ({ get: getMock }));
const latestMutationMock = vi.fn();

vi.mock('$lib/server/database', () => ({
  getDb: () => ({ prepare: prepareMock }),
}));

vi.mock('$lib/server/vaultPaths', () => ({
  getUserVaultPaths: (userId: string) => ({ root: `/vaults/${userId}` }),
}));

vi.mock('$lib/server/vaultFs', () => ({
  readVaultTextFile: (root: string, wikiPath: string) => `${root}:${wikiPath}`,
}));

vi.mock('$lib/wiki/latestMutation', () => ({
  getLatestWikiMutation: (_db: unknown, userId: string) => latestMutationMock(userId),
}));

beforeEach(() => {
  vi.clearAllMocks();
  getMock.mockReturnValue(undefined);
  latestMutationMock.mockReturnValue({ id: 'mutation-user-2' });
});

describe('wiki API user isolation', () => {
  it('reads the wiki index for the authenticated user', async () => {
    const { GET } = await import('./index/+server');

    const response = await GET({ locals: { user: { id: 'user-2', username: 'ada' } } } as any);
    const body = await response.json();

    expect(getMock).toHaveBeenCalledWith('user-2', 'index');
    expect(body.markdown).toBe('/vaults/user-2:wiki/index.md');
  });

  it('reads the wiki log for the authenticated user', async () => {
    const { GET } = await import('./log/+server');

    const response = await GET({ locals: { user: { id: 'user-2', username: 'ada' } } } as any);
    const body = await response.json();

    expect(getMock).toHaveBeenCalledWith('user-2', 'log');
    expect(body.markdown).toBe('/vaults/user-2:wiki/log.md');
  });

  it('reads latest wiki mutation for the authenticated user', async () => {
    const { GET } = await import('./mutations/latest/+server');

    const response = await GET({ locals: { user: { id: 'user-2', username: 'ada' } } } as any);
    const body = await response.json();

    expect(latestMutationMock).toHaveBeenCalledWith('user-2');
    expect(body.mutation).toEqual({ id: 'mutation-user-2' });
  });
});
