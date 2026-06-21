import type { GraphEntity, GraphRelation } from '../../types/graph';

export interface GraphRelationReviewState {
  reviewKey: string;
  accepted?: boolean;
  rejected?: boolean;
  updatedAt?: number;
}

export type GraphRelationReviewMap = Map<string, GraphRelationReviewState>;

function normalizeReviewName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function buildGraphRelationReviewKey(input: {
  fromName: string;
  toName: string;
  type: GraphRelation['type'] | string;
}): string {
  return `${input.type}:${normalizeReviewName(input.fromName)}->${normalizeReviewName(input.toName)}`;
}

export function buildGraphRelationReviewKeyForRelation(
  relation: GraphRelation,
  from: GraphEntity,
  to: GraphEntity
): string {
  return buildGraphRelationReviewKey({ fromName: from.name, toName: to.name, type: relation.type });
}

export function applyGraphRelationReview(
  relation: GraphRelation,
  from: GraphEntity,
  to: GraphEntity,
  reviews?: GraphRelationReviewMap
): GraphRelation {
  if (!reviews) return relation;
  const review = reviews.get(buildGraphRelationReviewKeyForRelation(relation, from, to));
  if (!review) return relation;
  return { ...relation, accepted: review.accepted, rejected: review.rejected };
}
