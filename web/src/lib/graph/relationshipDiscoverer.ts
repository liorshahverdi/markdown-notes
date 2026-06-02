/**
 * Discovers potential relationships between entities that share notes
 * but have no direct relation.
 */

import type { GraphEntity, GraphRelation } from '../../types/graph';

export interface ProposedRelationship {
  fromEntityId: string;
  toEntityId: string;
  type: string;
  confidence: number;
  evidence: string;
  noteIds: string[];
}

const MAX_CANDIDATES = 100;

export function findRelationshipCandidates(
  entities: GraphEntity[],
  relations: GraphRelation[]
): Array<{ entityA: GraphEntity; entityB: GraphEntity; sharedNoteIds: string[] }> {
  // Build set of existing direct relations (both directions)
  const existingRelations = new Set<string>();
  for (const rel of relations) {
    existingRelations.add(`${rel.fromEntityId}::${rel.toEntityId}`);
    existingRelations.add(`${rel.toEntityId}::${rel.fromEntityId}`);
  }

  const candidates: Array<{
    entityA: GraphEntity;
    entityB: GraphEntity;
    sharedNoteIds: string[];
  }> = [];

  // Compare all entity pairs
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      if (candidates.length >= MAX_CANDIDATES) break;

      const a = entities[i];
      const b = entities[j];

      // Skip if already related
      if (existingRelations.has(`${a.id}::${b.id}`)) continue;

      // Find shared note IDs — require at least 2 shared notes
      const aNotes = new Set(a.sourceNoteIds);
      const sharedNoteIds = b.sourceNoteIds.filter((nid) => aNotes.has(nid));

      if (sharedNoteIds.length >= 2) {
        candidates.push({ entityA: a, entityB: b, sharedNoteIds });
      }
    }
    if (candidates.length >= MAX_CANDIDATES) break;
  }

  return candidates;
}

export function buildRelationshipPrompt(
  entityA: GraphEntity,
  entityB: GraphEntity,
  noteContents: Array<{ title: string; content: string }>
): string {
  const noteSection = noteContents
    .map((n) => `### ${n.title}\n${n.content}`)
    .join('\n\n');

  return `Analyze whether a relationship exists between the entities "${entityA.name}" (${entityA.type}) and "${entityB.name}" (${entityB.type}).

These entities co-occur in the following notes:

${noteSection}

If a relationship exists, respond with a JSON object:
{
  "exists": true,
  "type": "related_to" | "mentions" | "links_to",
  "confidence": 0.0-1.0,
  "evidence": "brief explanation"
}

If no meaningful relationship exists, respond with:
{ "exists": false }`;
}
