import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFolders, readNotes } from '$lib/server/notesFile';
import { buildGraphSnapshot } from '$lib/server/graphSnapshot';
import { getDb } from '$lib/server/database';
import { readGraphRelationReviews } from '$lib/server/graphRelationReviews';
import { applyGraphRelationReview } from '$lib/graph/relationReviewKey';

export const GET: RequestHandler = async ({ url, locals }) => {
  const typeFilter = url.searchParams.get('type');
  const includeRejected = url.searchParams.get('includeRejected') === '1';

  const snapshot = buildGraphSnapshot(readNotes(locals.user!.id), readFolders(locals.user!.id));
  const entities = typeFilter
    ? snapshot.entities.filter((entity) => entity.type === typeFilter)
    : snapshot.entities;

  const entityIds = new Set(entities.map((entity) => entity.id));
  const entityById = new Map(snapshot.entities.map((entity) => [entity.id, entity]));
  const relationReviews = readGraphRelationReviews(getDb(), locals.user!.id);
  const relations = snapshot.relations
    .map((relation) => {
      const from = entityById.get(relation.fromEntityId);
      const to = entityById.get(relation.toEntityId);
      return from && to ? applyGraphRelationReview(relation, from, to, relationReviews) : relation;
    })
    .filter(
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
      clusters: snapshot.clusters.length,
    },
  });
};
