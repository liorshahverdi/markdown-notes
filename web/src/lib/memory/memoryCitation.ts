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
  edge?: Pick<GraphRelation, 'id' | 'fromEntityId' | 'toEntityId' | 'type'>;
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
  noteId?: string
): MemoryCitation {
  return {
    id: relation.id,
    title,
    kind: 'graph-edge',
    relevanceScore: Math.min(1, Math.max(0, score)),
    noteId,
    edge: {
      id: relation.id,
      fromEntityId: relation.fromEntityId,
      toEntityId: relation.toEntityId,
      type: relation.type,
    },
  };
}
