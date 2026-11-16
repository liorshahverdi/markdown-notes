import { buildGraphSnapshot } from '$lib/server/graphSnapshot';
import { applyGraphRelationReview, type GraphRelationReviewMap } from '$lib/graph/relationReviewKey';
import type { FolderRecord, NoteRecord } from '../../types/note';
import type { GraphEntity, GraphRelation } from '../../types/graph';

export interface GraphMemoryEvidence {
  relation: GraphRelation;
  from: GraphEntity;
  to: GraphEntity;
  sourceNoteIds: string[];
  score: number;
}

/** Pre-built graph (e.g. the materialized base + enrichment overlay). */
export interface GraphMemorySource {
  entities: GraphEntity[];
  relations: GraphRelation[];
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9_#+.-]+/i)
    .map((term) => term.trim())
    .filter((term) => term.length > 2);
}

function overlapScore(queryTerms: Set<string>, value: string): number {
  const terms = tokenize(value);
  if (terms.length === 0 || queryTerms.size === 0) return 0;
  let matches = 0;
  for (const term of terms) {
    if (queryTerms.has(term)) matches += 1;
  }
  return matches / Math.max(terms.length, queryTerms.size);
}

const TYPE_FACTOR: Partial<Record<GraphRelation['type'], number>> = {
  links_to: 1,
  depends_on: 0.95,
  implements: 0.95,
  causes: 0.95,
  part_of: 0.9,
  precedes: 0.9,
  created: 0.9,
  owns: 0.9,
  attended: 0.9,
  located_at: 0.9,
  contrasts_with: 0.9,
  mentions: 0.8,
  related_to: 0.75,
  mentioned_in: 0.7,
  contains: 0.6,
  child_of: 0.6,
  transitive: 0.5,
};

function reviewState(relation: GraphRelation): string {
  const state = relation.metadata?.reviewState;
  if (typeof state === 'string') return state;
  return relation.accepted === false ? 'auto' : 'base';
}

/**
 * Edge quality multiplier: review status × edge type × confidence × provenance.
 * Unreviewed automatic edges rank below explicit or human-accepted ones.
 */
export function graphEdgeQuality(relation: GraphRelation): number {
  const state = reviewState(relation);
  const statusFactor = state === 'accepted' ? 1 : state === 'base' ? 0.9 : 0.6;
  const typeFactor = TYPE_FACTOR[relation.type] ?? 0.8;
  const strength = relation.weight ?? relation.confidence ?? 0.75;
  const confidenceFactor = 0.5 + 0.5 * Math.max(0, Math.min(1, strength));
  const provenanceFactor = relation.provenance && relation.provenance.length > 0 ? 1 : 0.85;
  return statusFactor * typeFactor * confidenceFactor * provenanceFactor;
}

export function retrieveGraphMemory(input: {
  notes: NoteRecord[];
  folders: FolderRecord[];
  query: string;
  seedNoteIds?: string[];
  limit?: number;
  relationReviews?: GraphRelationReviewMap;
  graph?: GraphMemorySource;
}): GraphMemoryEvidence[] {
  const snapshot = input.graph ?? buildGraphSnapshot(input.notes, input.folders);
  const queryTerms = new Set(tokenize(input.query));
  const seedNoteIds = new Set(input.seedNoteIds ?? []);
  const entityById = new Map(snapshot.entities.map((entity) => [entity.id, entity]));
  const evidence: GraphMemoryEvidence[] = [];

  for (const relation of snapshot.relations) {
    const from = entityById.get(relation.fromEntityId);
    const to = entityById.get(relation.toEntityId);
    if (!from || !to) continue;
    const reviewedRelation = input.graph ? relation : applyGraphRelationReview(relation, from, to, input.relationReviews);
    if (reviewedRelation.rejected) continue;
    const state = reviewState(reviewedRelation);
    if (state === 'pending' || state === 'ephemeral') continue;

    const sourceNoteIds = Array.from(new Set([...from.sourceNoteIds, ...to.sourceNoteIds]));
    const touchesSeed = sourceNoteIds.some((noteId) => seedNoteIds.has(noteId));
    const nameScore = overlapScore(queryTerms, `${from.name} ${to.name} ${relation.type}`);
    const relevance = (touchesSeed ? 0.6 : 0) + nameScore;
    if (relevance <= 0) continue;
    const score = relevance * graphEdgeQuality(reviewedRelation);
    evidence.push({ relation: reviewedRelation, from, to, sourceNoteIds, score: Math.min(1, score) });
  }

  return evidence.sort((a, b) => b.score - a.score).slice(0, input.limit ?? 5);
}

export function formatGraphEvidence(evidence: GraphMemoryEvidence[]): string {
  if (evidence.length === 0) return '';
  const lines = evidence.map((item) => {
    const strength = item.relation.weight ?? item.relation.confidence;
    const confidence = typeof strength === 'number' ? `; confidence ${strength}` : '';
    const relation = item.relation.type.replace(/_/g, ' ');
    const label = reviewState(item.relation) === 'auto' ? ' [unreviewed model suggestion]' : '';
    return `- ${item.from.name} ${relation} ${item.to.name}${label} (source note ids: ${item.sourceNoteIds.join(', ')}${confidence})`;
  });
  return `Graph memory links:\n${lines.join('\n')}`;
}
