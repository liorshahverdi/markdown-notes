import { buildGraphSnapshot } from '$lib/server/graphSnapshot';
import type { FolderRecord, NoteRecord } from '../../types/note';
import type { GraphEntity, GraphRelation } from '../../types/graph';

export interface GraphMemoryEvidence {
  relation: GraphRelation;
  from: GraphEntity;
  to: GraphEntity;
  sourceNoteIds: string[];
  score: number;
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

export function retrieveGraphMemory(input: {
  notes: NoteRecord[];
  folders: FolderRecord[];
  query: string;
  seedNoteIds?: string[];
  limit?: number;
}): GraphMemoryEvidence[] {
  const snapshot = buildGraphSnapshot(input.notes, input.folders);
  const queryTerms = new Set(tokenize(input.query));
  const seedNoteIds = new Set(input.seedNoteIds ?? []);
  const entityById = new Map(snapshot.entities.map((entity) => [entity.id, entity]));

  const evidence: GraphMemoryEvidence[] = [];
  for (const relation of snapshot.relations) {
    const from = entityById.get(relation.fromEntityId);
    const to = entityById.get(relation.toEntityId);
    if (!from || !to) continue;

    const sourceNoteIds = Array.from(new Set([...from.sourceNoteIds, ...to.sourceNoteIds]));
    const touchesSeed = sourceNoteIds.some((noteId) => seedNoteIds.has(noteId));
    const nameScore = overlapScore(queryTerms, `${from.name} ${to.name} ${relation.type}`);
    const score = (touchesSeed ? 0.6 : 0) + nameScore;

    if (score <= 0) continue;
    evidence.push({ relation, from, to, sourceNoteIds, score: Math.min(1, score) });
  }

  return evidence.sort((a, b) => b.score - a.score).slice(0, input.limit ?? 5);
}

export function formatGraphEvidence(evidence: GraphMemoryEvidence[]): string {
  if (evidence.length === 0) return '';
  const lines = evidence.map((item) => {
    const confidence = typeof item.relation.weight === 'number' ? `; confidence ${item.relation.weight}` : '';
    const relation = item.relation.type.replace(/_/g, ' ');
    return `- ${item.from.name} ${relation} ${item.to.name} (source note ids: ${item.sourceNoteIds.join(', ')}${confidence})`;
  });
  return `Graph memory links:\n${lines.join('\n')}`;
}
