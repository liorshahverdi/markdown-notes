/**
 * Hub-owned lease on the llama.cpp fleet model (Laguna XS by default).
 *
 * The hub talks to the existing Pi fleet authority (`fleet-session.py`) with the
 * same remote-lease protocol used by Mac Pi clients: acquire/renew/release JSON
 * over stdin. The lease token lives only in this process's memory; it is never
 * sent to browsers, logged, or placed in argv.
 *
 * Lifecycle:
 * - `restart()` releases any lease we hold (last-owner release unloads a managed
 *   idle generation) and acquires a fresh one, activating the model on demand.
 * - While held, the lease is renewed every 30s as long as a visible browser tab
 *   reported activity recently. After the idle window the lease is released, so
 *   the model does not stay resident forever for an abandoned tab.
 * - If the hub dies, renewals stop and the fleet's cleanup timer expires the
 *   lease after its TTL (180s), as for any remote client.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';

export type LeasePhase = 'none' | 'acquiring' | 'held' | 'releasing' | 'error';

export interface LeaseSnapshot {
  phase: LeasePhase;
  key: string;
  managed?: boolean;
  acquiredAt?: string;
  renewedAt?: string;
  error?: string;
}

export interface ResidentModel { key: string; activity: string; leased: boolean; owners: number }

export type FleetRunner = (args: string[], stdin?: unknown, timeoutMs?: number) => Promise<unknown>;

export interface LeaseOptions {
  key?: string;
  runner?: FleetRunner;
  renewMs?: number;
  idleMs?: number;
  now?: () => number;
  identity?: { client: string; session: string; project: string; sensitive: boolean };
}

const MAX_ERROR = 300;

/** Run the fleet authority. Errors are reduced to the authority's own message. */
export const defaultRunner: FleetRunner = (args, stdin, timeoutMs = 16 * 60_000) =>
  new Promise((resolve, reject) => {
    // Path to the fleet authority script is deployment-specific and must be configured.
    const script = process.env.MODEL_LEASE_SCRIPT;
    if (!script) { reject(new Error('MODEL_LEASE_SCRIPT is not configured on the hub')); return; }
    const child = spawn('python3', [script, ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.stdout.on('data', (d) => { if (out.length < 1_000_000) out += d; });
    child.stderr.on('data', (d) => { if (err.length < 20_000) err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const lines = err.trim().split('\n').filter(Boolean);
        reject(new Error(lines.find((l) => l.startsWith('Pi fleet lifecycle:')) || lines.at(-1) || `fleet authority exited ${code}`));
        return;
      }
      try { resolve(JSON.parse(out)); } catch { reject(new Error('Invalid fleet authority response')); }
    });
    child.stdin.end(stdin === undefined ? '' : JSON.stringify(stdin));
  });

function clean(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  // Defensive: never surface anything token-shaped or long helper logs.
  return text.replace(/[A-Za-z0-9_-]{32,}/g, '[redacted]').slice(0, MAX_ERROR);
}

export class ModelLease {
  readonly key: string;
  private runner: FleetRunner;
  private renewMs: number;
  private idleMs: number;
  private now: () => number;
  private identity: NonNullable<LeaseOptions['identity']>;
  private token: string | undefined;
  private state: LeaseSnapshot;
  private timer: ReturnType<typeof setInterval> | undefined;
  private lastActivity: number;
  private pending: Promise<LeaseSnapshot> | undefined;

  constructor(options: LeaseOptions = {}) {
    this.key = options.key || process.env.MODEL_LEASE_KEY || 'laguna';
    this.runner = options.runner || defaultRunner;
    this.renewMs = options.renewMs ?? 30_000;
    this.idleMs = options.idleMs ?? Number(process.env.MODEL_LEASE_IDLE_MINUTES || 20) * 60_000;
    this.now = options.now || Date.now;
    this.identity = options.identity || {
      client: 'markdown-notes-hub',
      session: `markdown-notes-${process.pid}-${Date.now()}`,
      project: path.resolve(process.cwd(), '..'),
      // Notes are private: never share a generation across project boundaries.
      sensitive: process.env.MODEL_LEASE_SENSITIVE !== '0',
    };
    this.state = { phase: 'none', key: this.key };
    this.lastActivity = this.now();
  }

  snapshot(): LeaseSnapshot { return { ...this.state }; }

  /** Called when a visible browser tab polls health or uses the model. */
  touch(): void { this.lastActivity = this.now(); }

  /** Other fleet models that activation would stop (activation is exclusive). */
  async residentPeers(): Promise<ResidentModel[]> {
    const status = await this.runner(['status'], undefined, 60_000) as { instances?: Record<string, { generation: unknown; owners?: unknown[]; activity?: string }> };
    return Object.entries(status?.instances || {})
      .filter(([key, v]) => key !== this.key && v && v.generation)
      .map(([key, v]) => ({ key, activity: String(v.activity || 'unknown'), owners: v.owners?.length || 0, leased: (v.owners?.length || 0) > 0 }));
  }

  /** Release any lease we hold, then acquire a fresh one. Concurrent calls share one operation. */
  restart(): Promise<LeaseSnapshot> {
    if (this.pending) return this.pending;
    this.touch();
    this.pending = (async () => {
      try {
        this.stopTimer();
        if (this.token) {
          this.state = { phase: 'releasing', key: this.key };
          await this.releaseToken();
        }
        this.state = { phase: 'acquiring', key: this.key };
        const result = await this.runner(['remote-acquire'], { key: this.key, ...this.identity }) as { token?: string; managed?: boolean };
        if (typeof result?.token !== 'string') throw new Error('Fleet authority returned no lease');
        this.token = result.token;
        const at = new Date(this.now()).toISOString();
        this.state = { phase: 'held', key: this.key, managed: Boolean(result.managed), acquiredAt: at, renewedAt: at };
        this.timer = setInterval(() => { void this.tick(); }, this.renewMs);
        this.timer.unref?.();
      } catch (error) {
        this.token = undefined;
        this.state = { phase: 'error', key: this.key, error: clean(error) };
      } finally {
        this.pending = undefined;
      }
      return this.snapshot();
    })();
    return this.pending;
  }

  /** Release our lease (idempotent). The fleet unloads a managed idle generation if we were last. */
  release(): Promise<LeaseSnapshot> {
    if (this.pending) return this.pending.then(() => this.release());
    this.stopTimer();
    if (!this.token) { this.state = { phase: 'none', key: this.key }; return Promise.resolve(this.snapshot()); }
    this.pending = (async () => {
      this.state = { phase: 'releasing', key: this.key };
      try {
        await this.releaseToken();
        this.state = { phase: 'none', key: this.key };
      } catch (error) {
        this.state = { phase: 'error', key: this.key, error: clean(error) };
      } finally { this.pending = undefined; }
      return this.snapshot();
    })();
    return this.pending;
  }

  /** Renewal tick: renew while active, release when idle, drop on lost lease. */
  async tick(): Promise<void> {
    if (this.pending || !this.token) return;
    if (this.now() - this.lastActivity > this.idleMs) { await this.release(); return; }
    try {
      await this.runner(['remote-renew'], { key: this.key, token: this.token }, 60_000);
      this.state = { ...this.state, phase: 'held', renewedAt: new Date(this.now()).toISOString() };
    } catch (error) {
      // Expired or replaced generation: renewal can never succeed again.
      this.stopTimer();
      this.token = undefined;
      this.state = { phase: 'error', key: this.key, error: clean(error) };
    }
  }

  private async releaseToken(): Promise<void> {
    const token = this.token;
    this.token = undefined;
    if (token) await this.runner(['remote-release'], { key: this.key, token }, 5 * 60_000);
  }

  private stopTimer(): void { if (this.timer) clearInterval(this.timer); this.timer = undefined; }
}

let instance: ModelLease | undefined;

/** Process-wide hub lease. Released on adapter-node graceful shutdown. */
export function getModelLease(): ModelLease {
  if (!instance) {
    instance = new ModelLease();
    const lease = instance;
    process.once('sveltekit:shutdown' as never, () => { void lease.release(); });
  }
  return instance;
}
