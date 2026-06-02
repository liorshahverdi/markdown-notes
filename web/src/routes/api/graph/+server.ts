import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFolders, readNotes } from '$lib/server/notesFile';
import { buildGraphSnapshot } from '$lib/server/graphSnapshot';

export const GET: RequestHandler = async ({ url, locals }) => {
  const typeFilter = url.searchParams.get('type');

  const snapshot = buildGraphSnapshot(readNotes(locals.user!.id), readFolders(locals.user!.id));
  const entities = typeFilter
    ? snapshot.entities.filter((entity) => entity.type === typeFilter)
    : snapshot.entities;

  const entityIds = new Set(entities.map((entity) => entity.id));
  const relations = snapshot.relations.filter(
    (relation) => entityIds.has(relation.fromEntityId) && entityIds.has(relation.toEntityId)
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
