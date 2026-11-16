import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { readProposals } from '$lib/server/graph/graphStore';
import { attachProposalContext, createUserRelation, getUserGraph } from '$lib/server/graph/graphService';
import { readFolders, readNotes } from '$lib/server/notesFile';
import type { GraphProposalKind, GraphProposalStatus } from '$lib/graph/proposals';
import type { GraphRelation } from '../../../../types/graph';

const STATUSES: GraphProposalStatus[] = ['pending', 'applied', 'rejected', 'undone', 'obsolete'];
const KINDS: GraphProposalKind[] = ['relation', 'merge', 'type_correction', 'new_entity'];

export const GET: RequestHandler = async ({ url, locals }) => {
  const statusParam = url.searchParams.get('status');
  const kindParam = url.searchParams.get('kind');
  const status = statusParam
    ? (statusParam.split(',').filter((value) => STATUSES.includes(value as GraphProposalStatus)) as GraphProposalStatus[])
    : undefined;
  const kind = kindParam && KINDS.includes(kindParam as GraphProposalKind) ? (kindParam as GraphProposalKind) : undefined;
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 200) || 200, 1000);
  const noteId = url.searchParams.get('noteId') || undefined;
  const userId = locals.user!.id;
  const proposals = readProposals(getDb(), userId, { status, kind, noteId, limit });
  if (!proposals.some((proposal) => proposal.kind === 'merge')) return json({ proposals });
  // Merges need context (where each name comes from) to be reviewable.
  const notes = readNotes(userId);
  const graph = getUserGraph(userId, { notes, folders: readFolders(userId) });
  return json({ proposals: attachProposalContext(proposals, graph, notes) });
};

/** Create a relation explicitly (e.g. accepting a transitive suggestion). */
export const POST: RequestHandler = async ({ request, locals }) => {
  const body = (await request.json()) as Record<string, unknown>;
  const { fromKey, toKey, fromName, toName, type, source, metadata } = body;
  if (
    typeof fromKey !== 'string' ||
    typeof toKey !== 'string' ||
    typeof fromName !== 'string' ||
    typeof toName !== 'string' ||
    typeof type !== 'string' ||
    fromKey === toKey
  ) {
    throw error(400, 'fromKey, toKey, fromName, toName and type are required');
  }
  const proposal = createUserRelation(getDb(), locals.user!.id, {
    fromKey,
    toKey,
    fromName,
    toName,
    type: type as GraphRelation['type'],
    source: source === 'transitive' ? 'transitive' : 'user',
    metadata: metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : undefined,
  });
  return json({ ok: Boolean(proposal), proposal });
};
