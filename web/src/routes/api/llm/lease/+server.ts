import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getModelLease } from '$lib/server/modelLease';
import { enqueueGraphUpdate } from '$lib/server/graph/graphWorker';

/** Model lifecycle is an interactive-user action, never an API-token capability. */
function requireSession(locals: App.Locals) {
  if (locals.auth?.type !== 'session') throw error(403, 'Model lease control requires a signed-in browser session');
}

export const GET: RequestHandler = async ({ locals, url }) => {
  requireSession(locals);
  const lease = getModelLease();
  const body: Record<string, unknown> = { lease: lease.snapshot() };
  if (url.searchParams.get('peers') === '1') {
    try { body.peers = await lease.residentPeers(); } catch { body.peers = null; }
  }
  return json(body);
};

export const POST: RequestHandler = async ({ locals, request }) => {
  requireSession(locals);
  const { action, allowEvict } = await request.json().catch(() => ({}));
  const lease = getModelLease();
  if (action === 'release') return json({ lease: await lease.release() });
  if (action !== 'restart') throw error(400, 'Unknown action');

  // Fleet activation is exclusive: starting Laguna stops any other resident
  // model. Leased peers are refused by the fleet itself; untracked peers need
  // explicit confirmation from the user.
  if (allowEvict !== true) {
    let peers;
    try { peers = await lease.residentPeers(); } catch { throw error(503, 'Fleet status unavailable'); }
    if (peers.length) return json({ needsConfirm: true, peers, lease: lease.snapshot() }, { status: 409 });
  }
  const userId = locals.user?.id;
  void lease.restart().then((snapshot) => {
    // Graph passes skip model stages while Laguna is unloaded; resume them now.
    if (snapshot.phase === 'held' && userId) enqueueGraphUpdate(userId, 'model-ready');
  });
  return json({ lease: lease.snapshot() }, { status: 202 });
};
