/**
 * Knowledge graph client store.
 *
 * The server owns the graph: it rebuilds the deterministic graph from notes,
 * runs the enrichment loop and stores every proposal, merge and review. This
 * store only mirrors the materialized graph for visualization and forwards
 * review actions. Nothing graph-related is persisted in the browser.
 */
import { writable, get } from 'svelte/store';
import { buildGraphData } from '../graph/graphBuilder';
import type { GraphProposal, GraphProposalStatus, GraphQualityMetrics, GraphRunSummary, RetrievalEvalResult } from '../graph/proposals';
import type { GraphEntity, GraphRelation, GraphNode, GraphEdge } from '../../types/graph';

export const graphEntities = writable<GraphEntity[]>([]);
export const graphRelations = writable<GraphRelation[]>([]);
export const graphNodes = writable<GraphNode[]>([]);
export const graphEdges = writable<GraphEdge[]>([]);
export const selectedNodeId = writable<string | null>(null);
export const selectedEdgeId = writable<string | null>(null);
export const entityTypeFilter = writable<Set<string>>(
  new Set(['note', 'Person', 'Object', 'Location', 'Event', 'Other', 'folder'])
);
export const graphSearchText = writable<string>('');

export const graphProposals = writable<GraphProposal[]>([]);
export interface EnrichmentStatus {
  runs: GraphRunSummary[];
  metrics: GraphQualityMetrics | null;
  thresholds: Array<{ source: string; threshold: number | null; reviewed: number; acceptanceRate: number | null; reason: string }>;
  evalResult?: RetrievalEvalResult | null;
}
export const enrichmentStatus = writable<EnrichmentStatus>({ runs: [], metrics: null, thresholds: [] });
export const enrichmentRunning = writable(false);

/** Ephemeral transitive suggestions per entity (never persisted unless accepted). */
const ephemeralRelations = writable<GraphRelation[]>([]);

function rebuildVisData(): void {
  const entities = get(graphEntities);
  const relations = [...get(graphRelations), ...get(ephemeralRelations)];
  const filter = get(entityTypeFilter);
  const search = get(graphSearchText).toLowerCase();

  let filtered = entities.filter((e) => filter.has(e.type));
  if (search) {
    filtered = filtered.filter((e) => e.name.toLowerCase().includes(search));
  }

  const filteredIds = new Set(filtered.map((e) => e.id));
  const filteredRelations = relations.filter(
    (r) => filteredIds.has(r.fromEntityId) && filteredIds.has(r.toEntityId)
  );

  const { nodes, edges } = buildGraphData(filtered, filteredRelations);
  graphNodes.set(nodes);
  graphEdges.set(edges);
}

entityTypeFilter.subscribe(() => rebuildVisData());
graphSearchText.subscribe(() => rebuildVisData());

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${init?.method ?? 'GET'} ${url} failed: ${response.status}`);
  return (await response.json()) as T;
}

function postJson<T>(url: string, body: unknown): Promise<T> {
  return requestJson<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Load the materialized graph, including pending proposals and rejected edges for review. */
export async function loadGraphData(): Promise<void> {
  const data = await requestJson<{ entities: GraphEntity[]; relations: GraphRelation[] }>(
    '/api/graph?includePending=1&includeRejected=1'
  );
  graphEntities.set(data.entities);
  graphRelations.set(data.relations);
  const ids = new Set(data.entities.map((entity) => entity.id));
  ephemeralRelations.update((current) => current.filter((r) => ids.has(r.fromEntityId) && ids.has(r.toEntityId)));
  rebuildVisData();
}

export async function loadProposals(status?: GraphProposalStatus[]): Promise<void> {
  const query = status?.length ? `?status=${status.join(',')}` : '';
  const data = await requestJson<{ proposals: GraphProposal[] }>(`/api/graph/proposals${query}`);
  graphProposals.set(data.proposals);
}

export async function loadEnrichmentStatus(): Promise<void> {
  const [status, evalData] = await Promise.all([
    requestJson<Omit<EnrichmentStatus, 'evalResult'>>('/api/graph/enrich'),
    requestJson<{ result: RetrievalEvalResult }>('/api/graph/eval').catch(() => null),
  ]);
  enrichmentStatus.set({ ...status, evalResult: evalData?.result ?? null });
}

async function refreshAll(): Promise<void> {
  await Promise.all([loadGraphData(), loadProposals(), loadEnrichmentStatus().catch(() => undefined)]);
}

/** Run an enrichment pass on the server now, then refresh. */
export async function runEnrichment(): Promise<GraphRunSummary | null> {
  enrichmentRunning.set(true);
  try {
    const data = await postJson<{ run: GraphRunSummary }>('/api/graph/enrich', {});
    await refreshAll();
    return data.run;
  } finally {
    enrichmentRunning.set(false);
  }
}

/**
 * Re-process every note. Unlike the old client rebuild this keeps proposals,
 * rejections, merges and reviews — only per-note processing state is reset.
 */
export async function rebuildGraph(): Promise<void> {
  enrichmentRunning.set(true);
  try {
    await postJson('/api/graph/rebuild', {});
    await refreshAll();
  } finally {
    enrichmentRunning.set(false);
  }
}

/**
 * Notes are extracted on the server when saved; this just refreshes the view.
 * Kept for callers that used to trigger client-side extraction.
 */
export async function extractAndSaveEntities(
  _noteId?: string,
  _title?: string,
  _content?: string,
  _folderId?: string | null
): Promise<void> {
  if (typeof fetch !== 'function') return;
  try {
    await loadGraphData();
  } catch {
    // Graph view not open or server unavailable; the server graph is authoritative anyway.
  }
}

export async function reviewProposalAction(id: string, action: 'accept' | 'reject' | 'undo'): Promise<GraphProposal | null> {
  const data = await postJson<{ proposal: GraphProposal }>(`/api/graph/proposals/${encodeURIComponent(id)}`, { action });
  graphProposals.update((current) => current.map((item) => (item.id === id ? data.proposal : item)));
  await Promise.all([loadGraphData(), loadEnrichmentStatus().catch(() => undefined)]);
  return data.proposal;
}

function relationProposalId(relation: GraphRelation | undefined): string | undefined {
  const value = relation?.metadata?.proposalId;
  return typeof value === 'string' ? value : undefined;
}

async function reviewEdge(relationId: string, action: 'accept' | 'reject' | 'retype', type?: GraphRelation['type']): Promise<void> {
  const ephemeral = get(ephemeralRelations).find((relation) => relation.id === relationId);
  if (ephemeral) {
    if (action === 'reject') {
      ephemeralRelations.update((current) => current.filter((relation) => relation.id !== relationId));
      rebuildVisData();
      return;
    }
    await acceptSuggestion(ephemeral, type);
    return;
  }
  const relation = get(graphRelations).find((item) => item.id === relationId);
  await postJson('/api/graph/reviews', {
    relationId,
    proposalId: relationProposalId(relation),
    action,
    type,
  });
  await Promise.all([loadGraphData(), loadProposals(), loadEnrichmentStatus().catch(() => undefined)]);
}

export async function acceptRelation(relationId: string): Promise<void> {
  await reviewEdge(relationId, 'accept');
}

export async function rejectRelation(relationId: string): Promise<void> {
  await reviewEdge(relationId, 'reject');
  if (get(selectedEdgeId) === relationId) selectedEdgeId.set(null);
}

/** Edit an edge. Only the relation type is editable; retyping counts as a review. */
export async function updateRelation(relationId: string, patch: Partial<GraphRelation>): Promise<void> {
  if (!patch.type) return;
  await reviewEdge(relationId, 'retype', patch.type);
}

/** Persist an ephemeral suggestion as a user-approved relation. */
export async function acceptSuggestion(relation: GraphRelation, type?: GraphRelation['type']): Promise<void> {
  const entities = get(graphEntities);
  const from = entities.find((entity) => entity.id === relation.fromEntityId);
  const to = entities.find((entity) => entity.id === relation.toEntityId);
  if (!from || !to) return;
  await postJson('/api/graph/proposals', {
    fromKey: from.id,
    toKey: to.id,
    fromName: from.name,
    toName: to.name,
    type: type ?? relation.type,
    source: relation.type === 'transitive' ? 'transitive' : 'user',
    metadata: relation.metadata?.pathNames ? { path: relation.metadata.pathNames } : undefined,
  });
  ephemeralRelations.update((current) => current.filter((item) => item.id !== relation.id));
  await Promise.all([loadGraphData(), loadProposals()]);
}

/**
 * Show multi-hop suggestions for one entity (dashed). They are computed from
 * explicit/accepted edges only and are not stored unless accepted.
 */
export async function expandEntityNeighborhood(entityId: string): Promise<GraphRelation[]> {
  const data = await requestJson<{ relations: GraphRelation[] }>(
    `/api/graph/transitive?entityId=${encodeURIComponent(entityId)}`
  );
  ephemeralRelations.update((current) => [
    ...current.filter((relation) => relation.fromEntityId !== entityId),
    ...data.relations,
  ]);
  graphRelations.update((current) => current); // notify dependents
  rebuildVisData();
  return data.relations;
}

/** Ephemeral suggestions are looked up alongside real relations by detail panels. */
export function findRelation(relationId: string): GraphRelation | undefined {
  return get(graphRelations).find((r) => r.id === relationId) ?? get(ephemeralRelations).find((r) => r.id === relationId);
}

export { ephemeralRelations };
