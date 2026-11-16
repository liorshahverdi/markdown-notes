import type { GraphRelation } from '../../types/graph';
import type { NoteRecord } from '../../types/note';

export type MemoryCitationKind = 'note' | 'note-chunk' | 'graph-edge' | 'wiki';

export interface MemoryCitation {
  id: string;
  title: string;
  kind: MemoryCitationKind;
  relevanceScore: number;
  noteId?: string;
  excerpt?: string;
  edge?: Pick<GraphRelation, 'id' | 'fromEntityId' | 'toEntityId' | 'type'> & {
    fromName?: string;
    toName?: string;
    /** base | auto | accepted — "auto" means an unreviewed model/rule suggestion. */
    reviewState?: string;
  };
}

export function noteCitation(note: NoteRecord, score: number, excerpt?: string): MemoryCitation {
  return {
    id: note.id,
    noteId: note.id,
    title: note.title,
    kind: 'note',
    relevanceScore: Math.min(1, Math.max(0, score)),
    excerpt,
  };
}

export function graphEdgeCitation(
  relation: GraphRelation,
  title: string,
  score: number,
  noteId?: string,
  names?: { fromName: string; toName: string }
): MemoryCitation {
  // Prefer the note that actually states the edge, with its quote.
  const evidence = relation.provenance?.find((item) => item.excerpt) ?? relation.provenance?.[0];
  const reviewState = typeof relation.metadata?.reviewState === 'string' ? relation.metadata.reviewState : undefined;
  return {
    id: relation.id,
    title,
    kind: 'graph-edge',
    relevanceScore: Math.min(1, Math.max(0, score)),
    noteId: evidence?.noteId ?? noteId,
    excerpt: evidence?.excerpt,
    edge: {
      id: relation.id,
      fromEntityId: relation.fromEntityId,
      toEntityId: relation.toEntityId,
      type: relation.type,
      fromName: names?.fromName,
      toName: names?.toName,
      reviewState,
    },
  };
}
