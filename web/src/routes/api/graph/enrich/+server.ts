import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { readProposals, readReviewStats, readRuns } from '$lib/server/graph/graphStore';
import { BASE_THRESHOLDS, calibrateThreshold } from '$lib/server/graph/candidates';
import { computeGraphQualityMetrics } from '$lib/server/graph/graphEval';
import { getUserGraph } from '$lib/server/graph/graphService';
import { runGraphPassForUser } from '$lib/server/graph/graphWorker';
import type { GraphProposalSource } from '$lib/graph/proposals';

/** Loop status: recent runs, current quality metrics and calibrated thresholds. */
export const GET: RequestHandler = async ({ locals }) => {
  const db = getDb();
  const userId = locals.user!.id;
  const stats = readReviewStats(db, userId);
  const thresholds = (Object.keys(BASE_THRESHOLDS) as GraphProposalSource[])
    .filter((source) => source !== 'user')
    .map((source) => {
      const calibrated = calibrateThreshold(source, stats.get(source));
      return { ...calibrated, threshold: Number.isFinite(calibrated.threshold) ? calibrated.threshold : null };
    });
  return json({
    runs: readRuns(db, userId, 10),
    metrics: computeGraphQualityMetrics(getUserGraph(userId), readProposals(db, userId)),
    thresholds,
  });
};

/** Run an enrichment pass now. */
export const POST: RequestHandler = async ({ locals }) => {
  const run = await runGraphPassForUser(locals.user!.id, 'manual');
  return json({ ok: run.status === 'completed', run });
};
