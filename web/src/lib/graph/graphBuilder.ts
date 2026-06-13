import type {
  GraphEntity,
  GraphRelation,
  GraphNode,
  GraphEdge,
  EntityType,
} from '../../types/graph';

export const NODE_COLORS: Record<EntityType, string> = {
  note: '#3498db',
  Person: '#2ecc71',
  Object: '#f39c12',
  Location: '#f1c40f',
  Event: '#ec4899',
  Other: '#1abc9c',
  folder: '#8b5cf6',
};

const BASE_NODE_SIZE = 15;
const SIZE_PER_SOURCE = 2;

export interface BuildGraphDataOptions {
  includeRejected?: boolean;
}

export function buildGraphData(
  entities: GraphEntity[],
  relations: GraphRelation[],
  options: BuildGraphDataOptions = {}
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = entities.map((entity) => {
    const subtypeLabel = entity.subtype ? ` (${entity.subtype})` : '';
    return {
      id: entity.id,
      label: entity.name,
      group: entity.type,
      title: `${entity.type}${subtypeLabel}: ${entity.name}`,
      size: BASE_NODE_SIZE + entity.sourceNoteIds.length * SIZE_PER_SOURCE,
    };
  });

  const visibleRelations = options.includeRejected
    ? relations
    : relations.filter((relation) => !relation.rejected);

  const edges: GraphEdge[] = visibleRelations.map((relation) => ({
    id: relation.id,
    from: relation.fromEntityId,
    to: relation.toEntityId,
    label: relation.type,
    dashes: relation.type === 'transitive',
    width: relation.weight ?? 1,
  }));

  return { nodes, edges };
}
