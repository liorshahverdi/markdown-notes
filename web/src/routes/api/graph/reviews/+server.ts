import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { upsertGraphRelationReview } from '$lib/server/graphRelationReviews';
import { invalidateUserGraph, reviewGraphEdge } from '$lib/server/graph/graphService';
import type { GraphRelation } from '../../../../types/graph';

export const POST: RequestHandler = async ({ request, locals }) => {
  const body = await request.json();
  const { reviewKey, fromName, toName, relationType, accepted, rejected, relationId, proposalId, action, type } =
    body as Record<string, unknown>;
  const userId = locals.user!.id;

  // Edge-id based review: dispatches to proposals (overlay/pending edges) or base-edge reviews.
  if (typeof relationId === 'string') {
    const resolvedAction =
      action === 'retype' ? 'retype' : action === 'reject' || rejected === true ? 'reject' : 'accept';
    const result = reviewGraphEdge(getDb(), userId, {
      relationId,
      proposalId: typeof proposalId === 'string' ? proposalId : null,
      action: resolvedAction,
      type: typeof type === 'string' ? (type as GraphRelation['type']) : undefined,
    });
    if (!result.ok) throw error(404, 'Relation not found or action not applicable');
    return json({ ok: true, proposal: result.proposal ?? null });
  }

  if (
    typeof reviewKey !== 'string' ||
    typeof fromName !== 'string' ||
    typeof toName !== 'string' ||
    typeof relationType !== 'string'
  ) {
    throw error(400, 'reviewKey, fromName, toName, and relationType are required');
  }

  const review = upsertGraphRelationReview(getDb(), userId, {
    reviewKey,
    fromName,
    toName,
    relationType,
    accepted: accepted === true,
    rejected: rejected === true,
  });
  invalidateUserGraph(userId);

  return json({ ok: true, review });
};
