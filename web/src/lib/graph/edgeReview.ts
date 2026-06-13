import type { GraphRelation } from '../../types/graph';

export function getInferredEdgeReviewQueue(
  relations: GraphRelation[],
  confidenceThreshold = 0.7
): GraphRelation[] {
  return relations
    .filter((relation) => !relation.rejected)
    .filter((relation) => relation.accepted !== true)
    .filter((relation) => {
      const inferred = relation.type === 'inferred_by_model' || relation.provenance?.some((p) => p.method === 'llm');
      const lowConfidence = typeof relation.confidence === 'number' && relation.confidence < confidenceThreshold;
      return inferred || lowConfidence;
    })
    .sort((a, b) => (a.confidence ?? 0) - (b.confidence ?? 0));
}

export function acceptGraphEdge(relations: GraphRelation[], relationId: string): GraphRelation[] {
  const now = Date.now();
  return relations.map((relation) =>
    relation.id === relationId
      ? { ...relation, accepted: true, rejected: false, updatedAt: now }
      : relation
  );
}

export function rejectGraphEdge(relations: GraphRelation[], relationId: string): GraphRelation[] {
  const now = Date.now();
  return relations.map((relation) =>
    relation.id === relationId
      ? { ...relation, accepted: false, rejected: true, updatedAt: now }
      : relation
  );
}
