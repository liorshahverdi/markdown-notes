/**
 * Entity deduplication: find similar entities and merge them.
 */

import type { GraphEntity, GraphRelation } from '../../types/graph';

export interface DuplicateCandidate {
  entityA: GraphEntity;
  entityB: GraphEntity;
  similarity: number;
  reason: string;
}

export function findDuplicateCandidates(entities: GraphEntity[]): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];

  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const a = entities[i];
      const b = entities[j];
      const match = checkSimilarity(a.name, b.name);
      if (match) {
        candidates.push({
          entityA: a,
          entityB: b,
          similarity: match.similarity,
          reason: match.reason,
        });
      }
    }
  }

  return candidates;
}

function checkSimilarity(
  nameA: string,
  nameB: string
): { similarity: number; reason: string } | null {
  const lowerA = nameA.toLowerCase();
  const lowerB = nameB.toLowerCase();

  // Exact case-insensitive match
  if (lowerA === lowerB) {
    return { similarity: 1.0, reason: 'case-insensitive exact match' };
  }

  // Abbreviation patterns: X vs X.js, X vs XJS
  const normalizeAbbrev = (s: string) =>
    s
      .toLowerCase()
      .replace(/\.js$/, '')
      .replace(/js$/, '');

  if (normalizeAbbrev(nameA) === normalizeAbbrev(nameB)) {
    return { similarity: 0.9, reason: 'abbreviation/suffix match (e.g., X vs X.js vs XJS)' };
  }

  // Substring match (one contains the other)
  if (lowerA.includes(lowerB) || lowerB.includes(lowerA)) {
    const shorter = Math.min(lowerA.length, lowerB.length);
    const longer = Math.max(lowerA.length, lowerB.length);
    const similarity = shorter / longer;
    if (similarity >= 0.5) {
      return { similarity, reason: 'substring match' };
    }
  }

  return null;
}

export function buildDeduplicationPrompt(candidate: DuplicateCandidate): string {
  return `Two entities in the knowledge graph may be duplicates:

Entity A: "${candidate.entityA.name}" (type: ${candidate.entityA.type})
Entity B: "${candidate.entityB.name}" (type: ${candidate.entityB.type})

Detected similarity: ${candidate.reason} (score: ${candidate.similarity.toFixed(2)})

Should these entities be merged? Respond with JSON:
{
  "shouldMerge": true/false,
  "keepName": "preferred name to keep",
  "reason": "explanation"
}`;
}

export function mergeEntities(
  keepEntity: GraphEntity,
  removeEntity: GraphEntity,
  relations: GraphRelation[]
): { updatedRelations: GraphRelation[]; mergedEntity: GraphEntity } {
  // Combine sourceNoteIds (deduplicated)
  const allNoteIds = new Set([
    ...keepEntity.sourceNoteIds,
    ...removeEntity.sourceNoteIds,
  ]);

  const mergedEntity: GraphEntity = {
    ...keepEntity,
    sourceNoteIds: [...allNoteIds],
  };

  // Update all relations that reference the removed entity
  const updatedRelations = relations.map((rel) => {
    const updated = { ...rel };
    if (updated.fromEntityId === removeEntity.id) {
      updated.fromEntityId = keepEntity.id;
    }
    if (updated.toEntityId === removeEntity.id) {
      updated.toEntityId = keepEntity.id;
    }
    return updated;
  });

  return { updatedRelations, mergedEntity };
}
