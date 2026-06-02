import { detectClusters } from '$lib/skills/clusterDetector';
import { extractEntities, type ExtractedEntity } from '$lib/graph/entityExtractor';
import type { FolderRecord, NoteRecord } from '../../types/note';
import type { GraphEntity, GraphRelation } from '../../types/graph';

export interface GraphSnapshot {
  entities: GraphEntity[];
  relations: GraphRelation[];
  clusters: ReturnType<typeof detectClusters>;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function makeEntityId(entity: ExtractedEntity, noteId: string): string {
  if (entity.type === 'note') {
    return `note:${noteId}`;
  }

  const subtype = entity.subtype ? `:${normalizeName(entity.subtype)}` : '';
  return `${entity.type.toLowerCase()}${subtype}:${normalizeName(entity.name)}`;
}

function buildFolderPathIndex(folders: FolderRecord[]): Map<string, string[]> {
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const cache = new Map<string, string[]>();

  function resolve(folderId: string): string[] {
    const cached = cache.get(folderId);
    if (cached) return cached;

    const path: string[] = [];
    const seen = new Set<string>();
    let current = folderById.get(folderId);

    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      path.unshift(current.name);
      current = current.parentFolderId ? folderById.get(current.parentFolderId) : undefined;
    }

    cache.set(folderId, path);
    return path;
  }

  for (const folder of folders) {
    resolve(folder.id);
  }

  return cache;
}

function addEntity(
  entityMap: Map<string, GraphEntity>,
  nameIndex: Map<string, string[]>,
  entity: ExtractedEntity,
  noteId: string
): GraphEntity {
  const id = makeEntityId(entity, noteId);
  const existing = entityMap.get(id);

  if (existing) {
    if (!existing.sourceNoteIds.includes(noteId)) {
      existing.sourceNoteIds.push(noteId);
    }
    return existing;
  }

  const created: GraphEntity = {
    id,
    name: entity.name,
    type: entity.type,
    subtype: entity.subtype,
    sourceNoteIds: [noteId],
    confidence: entity.confidence,
  };

  entityMap.set(id, created);

  const key = normalizeName(entity.name);
  const ids = nameIndex.get(key) ?? [];
  ids.push(id);
  nameIndex.set(key, ids);

  return created;
}

function resolveEntityId(
  rawName: string,
  currentNoteTitle: string,
  currentNoteId: string,
  nameIndex: Map<string, string[]>
): string | null {
  if (normalizeName(rawName) === normalizeName(currentNoteTitle)) {
    return `note:${currentNoteId}`;
  }

  const matches = nameIndex.get(normalizeName(rawName));
  return matches?.[0] ?? null;
}

export function buildGraphSnapshot(notes: NoteRecord[], folders: FolderRecord[]): GraphSnapshot {
  const folderPaths = buildFolderPathIndex(folders);
  const entityMap = new Map<string, GraphEntity>();
  const relationMap = new Map<string, GraphRelation>();
  const nameIndex = new Map<string, string[]>();
  const extractedByNote = notes.map((note) => ({
    note,
    extraction: extractEntities(
      note.id,
      note.title,
      note.content,
      note.folderId ? folderPaths.get(note.folderId) : undefined
    ),
  }));

  for (const { note, extraction } of extractedByNote) {
    for (const entity of extraction.entities) {
      addEntity(entityMap, nameIndex, entity, note.id);
    }
  }

  for (const { note, extraction } of extractedByNote) {
    for (const relation of extraction.relations) {
      const fromEntityId = resolveEntityId(relation.fromName, note.title, note.id, nameIndex);
      const toEntityId = resolveEntityId(relation.toName, note.title, note.id, nameIndex);

      if (!fromEntityId || !toEntityId) continue;

      const relationId = `${relation.type}:${fromEntityId}:${toEntityId}`;
      if (!relationMap.has(relationId)) {
        relationMap.set(relationId, {
          id: relationId,
          fromEntityId,
          toEntityId,
          type: relation.type,
        });
      }
    }
  }

  const entities = Array.from(entityMap.values());
  const relations = Array.from(relationMap.values());

  return {
    entities,
    relations,
    clusters: detectClusters(entities, relations),
  };
}

export function selectGraphSubsetForNotes(
  snapshot: GraphSnapshot,
  noteIds: string[]
): { entities: GraphEntity[]; relations: GraphRelation[] } {
  const selectedNoteIds = new Set(noteIds);
  const entities = snapshot.entities.filter((entity) =>
    entity.sourceNoteIds.some((noteId) => selectedNoteIds.has(noteId))
  );
  const entityIds = new Set(entities.map((entity) => entity.id));
  const relations = snapshot.relations.filter(
    (relation) => entityIds.has(relation.fromEntityId) && entityIds.has(relation.toEntityId)
  );

  return { entities, relations };
}
