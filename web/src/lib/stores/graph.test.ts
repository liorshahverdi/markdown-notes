import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  acceptRelation,
  expandEntityNeighborhood,
  graphEdges,
  graphEntities,
  graphRelations,
  loadGraphData,
  rejectRelation,
  reviewProposalAction,
  selectedEdgeId,
  updateRelation,
} from './graph';
import type { GraphEntity, GraphRelation } from '../../types/graph';

const entities: GraphEntity[] = [
  { id: 'a', name: 'A', type: 'Other', sourceNoteIds: ['n1'] },
  { id: 'b', name: 'B', type: 'Other', sourceNoteIds: ['n1'] },
  { id: 'c', name: 'C', type: 'Other', sourceNoteIds: ['n2'] },
];

const relations: GraphRelation[] = [
  { id: 'overlay:r1', fromEntityId: 'a', toEntityId: 'b', type: 'related_to', confidence: 0.4, metadata: { reviewState: 'auto', proposalId: 'p1' } },
  { id: 'depends_on:b:c', fromEntityId: 'b', toEntityId: 'c', type: 'depends_on', confidence: 0.9, metadata: { reviewState: 'base' } },
];

type FetchCall = { url: string; body?: unknown };

function mockServer() {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.startsWith('/api/graph/transitive')) {
      return Response.json({
        relations: [{ id: 'ephemeral:transitive:a:c', fromEntityId: 'a', toEntityId: 'c', type: 'transitive', metadata: { reviewState: 'ephemeral' } }],
      });
    }
    if (url.startsWith('/api/graph/proposals/')) {
      return Response.json({ proposal: { id: 'p1', status: 'applied' } });
    }
    if (url.startsWith('/api/graph/proposals')) return Response.json({ proposals: [] });
    if (url.startsWith('/api/graph/enrich')) return Response.json({ runs: [], metrics: null, thresholds: [] });
    if (url.startsWith('/api/graph/eval')) return Response.json({ queries: [], result: { queryCount: 0, recallAtK: null, mrr: null } });
    if (url.startsWith('/api/graph?')) return Response.json({ entities, relations });
    return Response.json({ ok: true });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

describe('graph store (server-backed)', () => {
  beforeEach(() => {
    graphEntities.set([]);
    graphRelations.set([]);
    selectedEdgeId.set(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the materialized graph including pending and rejected edges for review', async () => {
    const calls = mockServer();
    await loadGraphData();
    expect(calls[0].url).toBe('/api/graph?includePending=1&includeRejected=1');
    expect(get(graphRelations)).toHaveLength(2);
    expect(get(graphEdges)).toHaveLength(2);
  });

  it('sends edge reviews to the server with the proposal id', async () => {
    const calls = mockServer();
    await loadGraphData();
    await acceptRelation('overlay:r1');
    expect(calls.find((c) => c.url === '/api/graph/reviews')?.body).toEqual({ relationId: 'overlay:r1', proposalId: 'p1', action: 'accept' });

    selectedEdgeId.set('depends_on:b:c');
    await rejectRelation('depends_on:b:c');
    expect(calls.filter((c) => c.url === '/api/graph/reviews')[1].body).toMatchObject({ relationId: 'depends_on:b:c', action: 'reject' });
    expect(get(selectedEdgeId)).toBeNull();
  });

  it('retypes edges through the review endpoint', async () => {
    const calls = mockServer();
    await loadGraphData();
    await updateRelation('depends_on:b:c', { type: 'implements' });
    expect(calls.find((c) => c.url === '/api/graph/reviews')?.body).toMatchObject({ action: 'retype', type: 'implements' });
  });

  it('shows transitive suggestions without persisting them, and persists on accept', async () => {
    const calls = mockServer();
    await loadGraphData();
    await expandEntityNeighborhood('a');
    expect(get(graphEdges).some((edge) => edge.id === 'ephemeral:transitive:a:c' && edge.dashes)).toBe(true);
    expect(calls.some((c) => c.url === '/api/graph/proposals' && c.body)).toBe(false);

    await acceptRelation('ephemeral:transitive:a:c');
    expect(calls.find((c) => c.url === '/api/graph/proposals' && c.body)?.body).toMatchObject({
      fromKey: 'a',
      toKey: 'c',
      type: 'transitive',
      source: 'transitive',
    });
  });

  it('forwards proposal decisions', async () => {
    const calls = mockServer();
    await reviewProposalAction('p1', 'undo');
    expect(calls[0]).toEqual({ url: '/api/graph/proposals/p1', body: { action: 'undo' } });
  });
});
