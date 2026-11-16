import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserGraph } from '$lib/server/graph/graphService';

export const GET: RequestHandler = async ({ url, locals }) => {
  const typeFilter = url.searchParams.get('type');
  const includeRejected = url.searchParams.get('includeRejected') === '1';
  const includePending = url.searchParams.get('includePending') === '1';

  const graph = getUserGraph(locals.user!.id, { includePending });
  const entities = typeFilter
    ? graph.entities.filter((entity) => entity.type === typeFilter)
    : graph.entities;

  const entityIds = new Set(entities.map((entity) => entity.id));
  const relations = graph.relations.filter(
    (relation) =>
      entityIds.has(relation.fromEntityId) &&
      entityIds.has(relation.toEntityId) &&
      (includeRejected || !relation.rejected)
  );

  return json({
    entities,
    relations,
    stats: {
      nodes: entities.length,
      edges: relations.length,
      clusters: graph.clusters.length,
    },
  });
};
