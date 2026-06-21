import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { upsertGraphRelationReview } from '$lib/server/graphRelationReviews';

export const POST: RequestHandler = async ({ request, locals }) => {
  const body = await request.json();
  const { reviewKey, fromName, toName, relationType, accepted, rejected } = body as Record<string, unknown>;

  if (
    typeof reviewKey !== 'string' ||
    typeof fromName !== 'string' ||
    typeof toName !== 'string' ||
    typeof relationType !== 'string'
  ) {
    throw error(400, 'reviewKey, fromName, toName, and relationType are required');
  }

  const review = upsertGraphRelationReview(getDb(), locals.user!.id, {
    reviewKey,
    fromName,
    toName,
    relationType,
    accepted: accepted === true,
    rejected: rejected === true,
  });

  return json({ ok: true, review });
};
