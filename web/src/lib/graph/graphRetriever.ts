/**
 * Graph-based retrieval: expands and re-ranks vector search results
 * using entity/relation data from the knowledge graph.
 */

import { db } from '../db';
import type { EntityRecord, RelationRecord } from '../db';

export interface GraphBoost {
  noteId: string;
  boost: number; // additive score bonus
  reason: 'entity_match' | 'graph_neighbor' | 'folder_match';
}

/**
 * Given a query and initial vector search results, use the knowledge graph
 * to expand and re-rank the results.
 *
 * Strategy:
 * 1. Match query terms against known entity names
 * 2. Find notes connected to matched entities (via sourceNoteIds)
 * 3. Follow relations to find neighbor notes (1-hop)
 * 4. Return boost scores for notes found via graph
 */
export async function getGraphBoosts(
  query: string,
  vectorNoteIds: string[],
  currentFolderId?: string | null
): Promise<GraphBoost[]> {
  const entities = await db.entities.toArray();
  const relations = await db.relations.toArray();

  if (entities.length === 0) return [];

  // 1. Match query terms against entity names
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);

  const matchedEntities = entities.filter((e) => {
    const nameLower = e.name.toLowerCase();
    // Exact substring match of entity name in query, or query term in entity name
    return (
      queryLower.includes(nameLower) ||
      queryTerms.some((t) => nameLower.includes(t))
    );
  });

  if (matchedEntities.length === 0) return [];

  // 2. Collect notes directly connected to matched entities
  const boostMap = new Map<string, GraphBoost>();
  const vectorNoteSet = new Set(vectorNoteIds);

  for (const entity of matchedEntities) {
    for (const noteId of entity.sourceNoteIds) {
      if (!boostMap.has(noteId)) {
        boostMap.set(noteId, {
          noteId,
          boost: vectorNoteSet.has(noteId) ? 0.05 : 0.03,
          reason: 'entity_match',
        });
      } else {
        // Multiple entity matches = stronger signal
        const existing = boostMap.get(noteId)!;
        existing.boost += 0.02;
      }
    }
  }

  // 3. Follow relations 1-hop from matched entities to find neighbors
  const matchedEntityIds = new Set(matchedEntities.map((e) => e.id));
  const entityById = new Map(entities.map((e) => [e.id, e]));

  for (const rel of relations) {
    let neighborEntity: EntityRecord | undefined;
    if (matchedEntityIds.has(rel.fromEntityId)) {
      neighborEntity = entityById.get(rel.toEntityId);
    } else if (matchedEntityIds.has(rel.toEntityId)) {
      neighborEntity = entityById.get(rel.fromEntityId);
    }

    if (!neighborEntity) continue;

    for (const noteId of neighborEntity.sourceNoteIds) {
      if (!boostMap.has(noteId)) {
        boostMap.set(noteId, {
          noteId,
          boost: 0.02,
          reason: 'graph_neighbor',
        });
      }
    }
  }

  // 4. Folder-scoped boosting: notes sharing the same folder entities
  if (currentFolderId) {
    // Find folder entities that reference this folderId (by name match)
    const folderEntities = entities.filter((e) => e.type === 'folder');
    for (const fe of folderEntities) {
      for (const noteId of fe.sourceNoteIds) {
        if (!boostMap.has(noteId)) {
          boostMap.set(noteId, {
            noteId,
            boost: 0.015,
            reason: 'folder_match',
          });
        }
      }
    }
  }

  return Array.from(boostMap.values());
}

/**
 * Extract relevant entity/relation triples as structured context for the RAG prompt.
 * Returns a formatted string of knowledge graph connections, or empty string if none found.
 */
export async function getGraphContext(
  query: string,
  noteIds: string[]
): Promise<string> {
  const entities = await db.entities.toArray();
  const relations = await db.relations.toArray();

  if (entities.length === 0 || relations.length === 0) return '';

  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);
  const noteIdSet = new Set(noteIds);

  // Find entities that are relevant: match query terms or belong to result notes
  const relevantEntities = entities.filter((e) => {
    const nameLower = e.name.toLowerCase();
    const matchesQuery =
      queryLower.includes(nameLower) ||
      queryTerms.some((t) => nameLower.includes(t));
    const matchesNotes = e.sourceNoteIds.some((id) => noteIdSet.has(id));
    return matchesQuery || matchesNotes;
  });

  if (relevantEntities.length === 0) return '';

  const relevantEntityIds = new Set(relevantEntities.map((e) => e.id));
  const entityById = new Map(entities.map((e) => [e.id, e]));

  // Find relations between relevant entities
  const triples: string[] = [];
  const seen = new Set<string>();

  for (const rel of relations) {
    const from = entityById.get(rel.fromEntityId);
    const to = entityById.get(rel.toEntityId);
    if (!from || !to) continue;

    // At least one end must be relevant
    if (!relevantEntityIds.has(rel.fromEntityId) && !relevantEntityIds.has(rel.toEntityId)) continue;

    const key = `${from.name}--${rel.type}-->${to.name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    triples.push(`- "${from.name}" --${rel.type}--> "${to.name}"`);

    // Cap at 20 triples to avoid overwhelming the prompt
    if (triples.length >= 20) break;
  }

  if (triples.length === 0) return '';

  return `Knowledge graph connections:\n${triples.join('\n')}`;
}

/**
 * Merge graph boosts into scored search results.
 * Returns re-ranked results with graph-discovered notes appended.
 */
export function applyGraphBoosts<T extends { noteId: string; score: number }>(
  results: T[],
  boosts: GraphBoost[]
): T[] {
  if (boosts.length === 0) return results;

  const boostByNote = new Map(boosts.map((b) => [b.noteId, b]));

  // Apply boosts to existing results
  const boosted = results.map((r) => {
    const boost = boostByNote.get(r.noteId);
    if (boost) {
      boostByNote.delete(r.noteId); // Mark as consumed
      return { ...r, score: r.score + boost.boost };
    }
    return r;
  });

  // Add graph-only notes (not found by embedding search) as new candidates
  // These are 1-hop neighbors that might be relevant but weren't in the vector results
  for (const [noteId, boost] of boostByNote) {
    // These weren't consumed above, meaning they're new candidates from the graph
    boosted.push({
      noteId,
      score: boost.boost,
      // Spread required T fields with sensible defaults
      chunkText: '',
      title: '',
    } as unknown as T);
  }

  // Re-sort by boosted score
  boosted.sort((a, b) => b.score - a.score);

  return boosted;
}
