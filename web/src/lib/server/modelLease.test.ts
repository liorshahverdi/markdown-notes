import { describe, expect, it, vi } from 'vitest';
import { ModelLease, type FleetRunner } from './modelLease';

const identity = { client: 'markdown-notes-hub', session: 's1', project: '/home/u/projects/markdown-notes', sensitive: true };
const TOKEN = 'tok_'.padEnd(43, 'x');

function fleet(overrides: Partial<Record<string, (stdin: any) => unknown>> = {}) {
  const calls: Array<{ cmd: string; stdin: any }> = [];
  const runner: FleetRunner = vi.fn(async (args, stdin) => {
    const cmd = args[0];
    calls.push({ cmd, stdin });
    const handler = overrides[cmd];
    if (handler) return handler(stdin);
    if (cmd === 'remote-acquire') return { token: TOKEN, managed: true, key: stdin.key, ttl: 180 };
    if (cmd === 'remote-renew') return { renewed: true, ttl: 180 };
    if (cmd === 'remote-release') return { released: true };
    if (cmd === 'status') return { instances: {} };
    throw new Error(`unexpected ${cmd}`);
  });
  return { runner, calls };
}

describe('hub model lease', () => {
  it('acquires via stdin with hub identity and never exposes the token', async () => {
    const { runner, calls } = fleet();
    const lease = new ModelLease({ key: 'laguna', runner, identity });
    const snap = await lease.restart();
    expect(calls).toEqual([{ cmd: 'remote-acquire', stdin: { key: 'laguna', ...identity } }]);
    expect(snap).toMatchObject({ phase: 'held', key: 'laguna', managed: true });
    expect(JSON.stringify(snap)).not.toContain(TOKEN);
    await lease.release();
  });

  it('restart releases the held lease before acquiring a fresh one', async () => {
    const { runner, calls } = fleet();
    const lease = new ModelLease({ key: 'laguna', runner, identity });
    await lease.restart();
    await lease.restart();
    expect(calls.map((c) => c.cmd)).toEqual(['remote-acquire', 'remote-release', 'remote-acquire']);
    expect(calls[1].stdin).toEqual({ key: 'laguna', token: TOKEN });
    await lease.release();
  });

  it('concurrent restarts share one acquisition', async () => {
    const { runner, calls } = fleet();
    const lease = new ModelLease({ key: 'laguna', runner, identity });
    await Promise.all([lease.restart(), lease.restart()]);
    expect(calls.filter((c) => c.cmd === 'remote-acquire')).toHaveLength(1);
    await lease.release();
  });

  it('renews while active and releases after the idle window', async () => {
    let now = 0;
    const { runner, calls } = fleet();
    const lease = new ModelLease({ key: 'laguna', runner, identity, idleMs: 1000, now: () => now });
    await lease.restart();
    now = 500; await lease.tick();
    expect(calls.at(-1)?.cmd).toBe('remote-renew');
    now = 2000; await lease.tick();
    expect(calls.at(-1)?.cmd).toBe('remote-release');
    expect(lease.snapshot().phase).toBe('none');
  });

  it('activity keeps the lease alive past the idle window', async () => {
    let now = 0;
    const { runner, calls } = fleet();
    const lease = new ModelLease({ key: 'laguna', runner, identity, idleMs: 1000, now: () => now });
    await lease.restart();
    now = 900; lease.touch();
    now = 1500; await lease.tick();
    expect(calls.at(-1)?.cmd).toBe('remote-renew');
    await lease.release();
  });

  it('a refused acquisition reports the authority reason without a token', async () => {
    const { runner } = fleet({ 'remote-acquire': () => { throw new Error('Pi fleet lifecycle: Another live session uses the fleet; refusing eviction/restart'); } });
    const lease = new ModelLease({ key: 'laguna', runner, identity });
    const snap = await lease.restart();
    expect(snap.phase).toBe('error');
    expect(snap.error).toContain('Another live session uses the fleet');
  });

  it('a lost lease stops renewing and requires an explicit restart', async () => {
    const { runner, calls } = fleet({ 'remote-renew': () => { throw new Error('Pi fleet lifecycle: Remote lease missing or expired; acquire again'); } });
    const lease = new ModelLease({ key: 'laguna', runner, identity });
    await lease.restart();
    await lease.tick();
    expect(lease.snapshot()).toMatchObject({ phase: 'error' });
    await lease.tick();
    expect(calls.filter((c) => c.cmd === 'remote-renew')).toHaveLength(1);
    await lease.release();
    expect(calls.some((c) => c.cmd === 'remote-release')).toBe(false);
  });

  it('lists other resident models that exclusive activation would stop', async () => {
    const { runner } = fleet({ status: () => ({ instances: {
      laguna: { generation: { pid: 1 }, owners: [] },
      'strata-next': { generation: { pid: 2 }, owners: [], activity: 'idle' },
      tielcoder: { generation: null, owners: [] },
    } }) });
    const lease = new ModelLease({ key: 'laguna', runner, identity });
    expect(await lease.residentPeers()).toEqual([{ key: 'strata-next', activity: 'idle', owners: 0, leased: false }]);
  });

  it('redacts token-shaped text from errors', async () => {
    const { runner } = fleet({ 'remote-acquire': () => { throw new Error(`boom ${TOKEN}`); } });
    const snap = await new ModelLease({ key: 'laguna', runner, identity }).restart();
    expect(snap.error).not.toContain(TOKEN);
  });
});

describe("defaultRunner configuration", () => {
  it("refuses to run without MODEL_LEASE_SCRIPT instead of guessing a host-specific path", async () => {
    const previous = process.env.MODEL_LEASE_SCRIPT;
    delete process.env.MODEL_LEASE_SCRIPT;
    try {
      const { defaultRunner } = await import("./modelLease");
      await expect(defaultRunner(["remote-status"], {})).rejects.toThrow(/MODEL_LEASE_SCRIPT is not configured/);
    } finally {
      if (previous !== undefined) process.env.MODEL_LEASE_SCRIPT = previous;
    }
  });
});
