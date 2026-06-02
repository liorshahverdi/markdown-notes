import Dexie, { type Table } from 'dexie';
import type { NoteRecord, FolderRecord } from '../../types/note';
import type { ImprovementRecord } from '../graph/improvementLog';

export interface EmbeddingRecord {
  id: string;
  noteId: string;
  textHash: string;
  chunkText: string;
  vector: number[];
}

export interface EntityRecord {
  id: string;
  name: string;
  type: string;
  subtype?: string;
  sourceNoteIds: string[];
}

export interface RelationRecord {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  type: string;
  weight: number;
}

export interface SkillRecord {
  id: string;
  name: string;
  domain: string;
  type: string;
  createdAt: number;
  sourceNoteIds: string[];
  parentSkillIds: string[];
}

export interface ChatMessageRecord {
  id: string;
  noteId: string | null; // null = global chat
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{ noteId: string; title: string; relevanceScore: number }>;
  timestamp: number;
}

export interface TraceDBRecord {
  id: string;
  type: string;
  timestamp: number;
  noteId?: string;
  data: string; // JSON-stringified TraceRecord
}

export class MarkdownNotesDB extends Dexie {
  notes!: Table<NoteRecord, string>;
  folders!: Table<FolderRecord, string>;
  embeddings!: Table<EmbeddingRecord, string>;
  entities!: Table<EntityRecord, string>;
  relations!: Table<RelationRecord, string>;
  improvements!: Table<ImprovementRecord, string>;
  skills!: Table<SkillRecord, string>;
  chatMessages!: Table<ChatMessageRecord, string>;
  traces!: Table<TraceDBRecord, string>;

  constructor() {
    super('markdownnotes', {
      indexedDB: globalThis.indexedDB,
      IDBKeyRange: globalThis.IDBKeyRange,
    });

    this.version(1).stores({
      notes: 'id, title, dateModified, isPinned',
      embeddings: 'id, textHash',
      entities: 'id, type, *sourceNoteIds',
      relations: 'id, fromEntityId, toEntityId',
      improvements: 'id, timestamp, type, status',
      skills: 'id, name, domain, type, createdAt, *sourceNoteIds, *parentSkillIds',
    });

    this.version(2).stores({
      notes: 'id, title, dateModified, isPinned',
      embeddings: 'id, noteId, textHash',
      entities: 'id, type, *sourceNoteIds',
      relations: 'id, fromEntityId, toEntityId',
      improvements: 'id, timestamp, type, status',
      skills: 'id, name, domain, type, createdAt, *sourceNoteIds, *parentSkillIds',
    });

    this.version(3).stores({
      notes: 'id, title, dateModified, isPinned, folderId',
      folders: 'id, parentFolderId, sortOrder',
      embeddings: 'id, noteId, textHash',
      entities: 'id, type, *sourceNoteIds',
      relations: 'id, fromEntityId, toEntityId',
      improvements: 'id, timestamp, type, status',
      skills: 'id, name, domain, type, createdAt, *sourceNoteIds, *parentSkillIds',
    });

    this.version(4)
      .stores({
        notes: 'id, title, dateModified, isPinned, folderId',
        folders: 'id, parentFolderId, sortOrder',
        embeddings: 'id, noteId, textHash',
        entities: 'id, type, *sourceNoteIds',
        relations: 'id, fromEntityId, toEntityId, [fromEntityId+toEntityId+type]',
        improvements: 'id, timestamp, type, status',
        skills: 'id, name, domain, type, createdAt, *sourceNoteIds, *parentSkillIds',
      })
      .upgrade((tx) => {
        return tx
          .table('relations')
          .toCollection()
          .modify((record: Record<string, unknown>) => {
            if (!record.type) record.type = 'mentions';
            if (record.weight == null) record.weight = 1;
          });
      });

    this.version(5).stores({
      notes: 'id, title, dateModified, isPinned, folderId',
      folders: 'id, parentFolderId, sortOrder',
      embeddings: 'id, noteId, textHash',
      entities: 'id, type, *sourceNoteIds',
      relations: 'id, fromEntityId, toEntityId, [fromEntityId+toEntityId+type]',
      improvements: 'id, timestamp, type, status',
      skills: 'id, name, domain, type, createdAt, *sourceNoteIds, *parentSkillIds',
      chatMessages: 'id, noteId, role, timestamp',
    });

    this.version(6)
      .stores({
        notes: 'id, title, dateModified, isPinned, folderId',
        folders: 'id, parentFolderId, sortOrder',
        embeddings: 'id, noteId, textHash',
        entities: 'id, type, *sourceNoteIds',
        relations: 'id, fromEntityId, toEntityId, [fromEntityId+toEntityId+type]',
        improvements: 'id, timestamp, type, status',
        skills: 'id, name, domain, type, createdAt, *sourceNoteIds, *parentSkillIds',
        chatMessages: 'id, noteId, role, timestamp',
        traces: 'id, type, timestamp, noteId',
      })
      .upgrade((tx) => {
        // Migrate old entity types to POLE+O model
        const typeMap: Record<string, { type: string; subtype?: string }> = {
          person: { type: 'Person' },
          organization: { type: 'Person', subtype: 'organization' },
          place: { type: 'Location' },
          topic: { type: 'Other', subtype: 'topic' },
          tag: { type: 'Other', subtype: 'tag' },
        };

        return tx
          .table('entities')
          .toCollection()
          .modify((record: Record<string, unknown>) => {
            const mapping = typeMap[record.type as string];
            if (mapping) {
              record.type = mapping.type;
              if (mapping.subtype) {
                record.subtype = mapping.subtype;
              }
            }
          });
      });

    // Version 7: Clear embeddings due to embedding model change
    // (nomic-embed-text 768-dim replaces all-MiniLM-L6-v2 384-dim)
    this.version(7)
      .stores({
        notes: 'id, title, dateModified, isPinned, folderId',
        folders: 'id, parentFolderId, sortOrder',
        embeddings: 'id, noteId, textHash',
        entities: 'id, type, *sourceNoteIds',
        relations: 'id, fromEntityId, toEntityId, [fromEntityId+toEntityId+type]',
        improvements: 'id, timestamp, type, status',
        skills: 'id, name, domain, type, createdAt, *sourceNoteIds, *parentSkillIds',
        chatMessages: 'id, noteId, role, timestamp',
        traces: 'id, type, timestamp, noteId',
      })
      .upgrade((tx) => {
        // Clear all embeddings — dimension change requires full re-embedding
        return tx.table('embeddings').clear();
      });
  }
}

export const db = new MarkdownNotesDB();
