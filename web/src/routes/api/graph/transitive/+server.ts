import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserGraph, transitiveSuggestions } from '$lib/server/graph/graphService';

/** Ephemeral multi-hop suggestions for one entity. Nothing is persisted. */
export const GET: RequestHandler = async ({ url, locals }) => {
  const entityId = url.searchParams.get('entityId');
  if (!entityId) throw error(400, 'entityId is required');
  const graph = getUserGraph(locals.user!.id);
  return json({ relations: transitiveSuggestions(graph, entityId) });
};
