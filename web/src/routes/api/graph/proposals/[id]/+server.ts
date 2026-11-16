import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { reviewProposal, type ProposalAction } from '$lib/server/graph/graphService';

const ACTIONS: ProposalAction[] = ['accept', 'reject', 'undo'];

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const body = (await request.json()) as { action?: string };
  if (!body.action || !ACTIONS.includes(body.action as ProposalAction)) {
    throw error(400, `action must be one of ${ACTIONS.join(', ')}`);
  }
  const proposal = reviewProposal(getDb(), locals.user!.id, params.id, body.action as ProposalAction);
  if (!proposal) throw error(404, 'Proposal not found');
  return json({ ok: true, proposal });
};
