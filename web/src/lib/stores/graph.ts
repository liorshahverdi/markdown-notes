import { writable, get } from 'svelte/store';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index';
import { notes } from './notes';
import { getFolderPathArray, loadFolders, folders } from './folders';
import { buildGraphData } from '../graph/graphBuilder';
import { mergeEntities } from '../graph/entityDeduplicator';
import { runExtractionPipeline } from '../graph/extractionPipeline';
import { findTransitiveCandidatesForEntity } from '../graph/transitiveInference';
import type {
  GraphEntity,
  GraphRelation,
  GraphNode,
  GraphEdge,
} from '../../types/graph';

export const graphEntities = writable<GraphEntity[]>([]);
export const graphRelations = writable<GraphRelation[]>([]);
export const graphNodes = writable<GraphNode[]>([]);
export const graphEdges = writable<GraphEdge[]>([]);
export const selectedNodeId = writable<string | null>(null);
export const selectedEdgeId = writable<string | null>(null);
export const entityTypeFilter = writable<Set<string>>(
  new Set(['note', 'Person', 'Object', 'Location', 'Event', 'Other', 'folder'])
);
export const graphSearchText = writable<string>('');

function persistableRelation(relation: GraphRelation) {
  return {
    id: relation.id,
    fromEntityId: relation.fromEntityId,
    toEntityId: relation.toEntityId,
    type: relation.type,
    weight: relation.weight ?? 1,
    confidence: relation.confidence,
    provenance: relation.provenance,
    accepted: relation.accepted,
    rejected: relation.rejected,
    createdAt: relation.createdAt,
    updatedAt: relation.updatedAt,
    metadata: relation.metadata,
  };
}

function rebuildVisData(entities: GraphEntity[], relations: GraphRelation[]): void {
  const filter = get(entityTypeFilter);
  const search = get(graphSearchText).toLowerCase();

  let filtered = entities.filter((e) => filter.has(e.type));
  if (search) {
    filtered = filtered.filter((e) => e.name.toLowerCase().includes(search));
  }

  const filteredIds = new Set(filtered.map((e) => e.id));
  const filteredRelations = relations.filter(
    (r) => filteredIds.has(r.fromEntityId) && filteredIds.has(r.toEntityId)
  );

  const { nodes, edges } = buildGraphData(filtered, filteredRelations);
  graphNodes.set(nodes);
  graphEdges.set(edges);
}

/**
 * Wipe all entities, relations, and improvements from DB and in-memory stores,
 * then re-extract the graph from every note. Call this after schema changes
 * or when the graph has accumulated stale/duplicate data.
 */
export async function rebuildGraph(): Promise<void> {
  // 1. Clear DB tables
  await db.entities.clear();
  await db.relations.clear();
  await db.improvements.clear();

  // 2. Clear in-memory stores
  graphEntities.set([]);
  graphRelations.set([]);
  graphNodes.set([]);
  graphEdges.set([]);

  // 3. Ensure folders are loaded so folder entities/relations are created
  if (get(folders).length === 0) {
    await loadFolders();
  }

  // 4. Re-extract from every note
  const allNotes = get(notes);
  for (const note of allNotes) {
    await extractAndSaveEntities(note.id, note.title, note.content, note.folderId);
  }

  // 5. Second pass: cross-reference note content against all note titles
  // The first pass may miss references because note B's entity didn't exist
  // when note A was processed. This pass catches those.
  await crossReferenceNotes(allNotes);
}

const TITLE_STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for',
  'is', 'it', 'by', 'with', 'from', 'as', 'be', 'was', 'are', 'not',
  'my', 'this', 'that', 'notes', 'note', 'meeting', 'transcript', 'list',
]);

/**
 * Extract significant keywords from a title (lowercased, stopwords removed,
 * short words removed, date-like tokens removed).
 */
function titleKeywords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !TITLE_STOPWORDS.has(w))
      // Remove date-like tokens (e.g., "4/1/2026", "2026")
      .filter((w) => !/^\d+$/.test(w))
  );
}

function relationExcerpt(content: string, fromName: string, toName: string, explicit?: string): string {
  if (explicit) return explicit;
  const normalizedFrom = fromName.trim().toLowerCase();
  const normalizedTo = toName.trim().toLowerCase();
  const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
  return (
    lines.find((line) => {
      const lower = line.toLowerCase();
      return lower.includes(normalizedFrom) && lower.includes(normalizedTo);
    }) ??
    lines.find((line) => line.toLowerCase().includes(normalizedFrom)) ??
    lines.find((line) => line.toLowerCase().includes(normalizedTo)) ??
    content.slice(0, 240)
  );
}

/**
 * Cross-reference notes after extraction:
 * 1. Content mentions: if note A's content contains note B's full title
 * 2. Title similarity: if two note titles share 2+ significant keywords
 */
async function crossReferenceNotes(
  allNotes: Array<{ id: string; title: string; content: string }>
): Promise<void> {
  const entities = get(graphEntities);
  const noteEntities = entities.filter((e) => e.type === 'note' && e.name.length > 3);
  const newRelations: GraphRelation[] = [];
  const addedPairs = new Set<string>();

  async function addRelationIfNew(
    fromId: string,
    toId: string,
    type: GraphRelation['type'],
    weight: number,
  ): Promise<void> {
    const pairKey = [fromId, toId].sort().join('::');
    if (addedPairs.has(pairKey)) return;

    const existing = await db.relations
      .where('[fromEntityId+toEntityId+type]')
      .equals([fromId, toId, type])
      .first();
    const existingReverse = await db.relations
      .where('[fromEntityId+toEntityId+type]')
      .equals([toId, fromId, type])
      .first();
    if (existing || existingReverse) return;

    addedPairs.add(pairKey);
    const relation: GraphRelation = {
      id: uuidv4(),
      fromEntityId: fromId,
      toEntityId: toId,
      type,
      weight,
    };
    newRelations.push(relation);
    await db.relations.put({
      id: relation.id,
      fromEntityId: relation.fromEntityId,
      toEntityId: relation.toEntityId,
      type: relation.type,
      weight: relation.weight ?? 1,
    });
  }

  // Pass 1: Content mentions (note A's content contains note B's full title)
  for (const note of allNotes) {
    const contentLower = note.content.toLowerCase();
    const thisEntity = noteEntities.find(
      (e) => e.name.toLowerCase() === note.title.toLowerCase()
    );
    if (!thisEntity) continue;

    for (const otherEntity of noteEntities) {
      if (otherEntity.id === thisEntity.id) continue;
      if (contentLower.includes(otherEntity.name.toLowerCase())) {
        await addRelationIfNew(thisEntity.id, otherEntity.id, 'mentions', 0.8);
      }
    }
  }

  // Pass 2: Keyword similarity between all named entities (notes + topics)
  // If two entities share 2+ significant title keywords → related_to edge
  const namedEntities = entities.filter(
    (e) => (e.type === 'note' || (e.type === 'Other' && e.subtype === 'topic')) && e.name.length > 3
  );
  // Pre-compute keywords for each entity
  const entityKeywords = namedEntities.map((e) => ({
    entity: e,
    keywords: titleKeywords(e.name),
  })).filter((ek) => ek.keywords.size > 0);

  for (let i = 0; i < entityKeywords.length; i++) {
    const { entity: a, keywords: kwA } = entityKeywords[i];
    for (let j = i + 1; j < entityKeywords.length; j++) {
      const { entity: b, keywords: kwB } = entityKeywords[j];
      // Skip if same name (case-insensitive) — already the same or merged entity
      if (a.name.toLowerCase() === b.name.toLowerCase()) continue;

      let shared = 0;
      for (const w of kwA) {
        if (kwB.has(w)) shared++;
      }
      if (shared >= 2) {
        const weight = Math.min(shared / Math.max(kwA.size, kwB.size), 1);
        await addRelationIfNew(a.id, b.id, 'related_to', weight);
      }
    }
  }

  if (newRelations.length > 0) {
    graphRelations.update((current) => [...current, ...newRelations]);
    rebuildVisData(get(graphEntities), get(graphRelations));
  }
}

export async function loadGraphData(): Promise<void> {
  const allNotes = get(notes);
  const entityRecords = await db.entities.toArray();
  const relationRecords = await db.relations.toArray();

  // Convert DB records to full GraphEntity objects
  const entities: GraphEntity[] = entityRecords.map((er) => ({
    id: er.id,
    name: er.name || er.id,
    type: er.type as GraphEntity['type'],
    subtype: er.subtype,
    sourceNoteIds: er.sourceNoteIds,
  }));

  const relations: GraphRelation[] = relationRecords.map((rr) => ({
    id: rr.id,
    fromEntityId: rr.fromEntityId,
    toEntityId: rr.toEntityId,
    type: (rr.type || 'mentions') as GraphRelation['type'],
    weight: rr.weight ?? 1,
    confidence: rr.confidence,
    provenance: rr.provenance as GraphRelation['provenance'],
    accepted: rr.accepted,
    rejected: rr.rejected,
    createdAt: rr.createdAt,
    updatedAt: rr.updatedAt,
    metadata: rr.metadata,
  }));

  graphEntities.set(entities);
  graphRelations.set(relations);
  rebuildVisData(entities, relations);
}

export async function extractAndSaveEntities(
  noteId: string,
  title: string,
  content: string,
  folderId?: string | null
): Promise<void> {
  const folderPath = folderId ? getFolderPathArray(folderId) : undefined;
  const { entities: extracted, relations: extractedRelations } =
    await runExtractionPipeline(noteId, title, content, folderPath);

  // Clean stale relations: find entities that are ONLY sourced from this note
  // (not shared with other notes) and delete their relations.
  // For shared entities, we keep existing relations from other notes intact.
  const existingEntities = get(graphEntities).filter((e) => e.sourceNoteIds.includes(noteId));
  const exclusiveEntityIds = new Set(
    existingEntities
      .filter((e) => e.sourceNoteIds.length === 1 && e.sourceNoteIds[0] === noteId)
      .map((e) => e.id)
  );
  if (exclusiveEntityIds.size > 0) {
    const allRelations = await db.relations.toArray();
    const staleRelationIds = allRelations
      .filter((r) => exclusiveEntityIds.has(r.fromEntityId) || exclusiveEntityIds.has(r.toEntityId))
      .map((r) => r.id);
    if (staleRelationIds.length > 0) {
      await db.relations.bulkDelete(staleRelationIds);
    }
    // Also remove from in-memory store
    graphRelations.update((current) =>
      current.filter((r) => !exclusiveEntityIds.has(r.fromEntityId) && !exclusiveEntityIds.has(r.toEntityId))
    );
  }

  // Map extracted entity names to IDs (both by type::name key and by lowercase name)
  const entityIdMap = new Map<string, string>();
  const entityIdByName = new Map<string, string>();
  const graphEntityList: GraphEntity[] = [];

  for (const ext of extracted) {
    const key = `${ext.type}::${ext.name}`;
    // Check if entity already exists in current store OR in the batch being built
    // (case-insensitive). First try exact type match, then cross-type match.
    const extNameLower = ext.name.toLowerCase();
    const existing = get(graphEntities).find(
      (e) => e.type === ext.type && e.name.toLowerCase() === extNameLower
    ) ?? graphEntityList.find(
      (e) => e.type === ext.type && e.name.toLowerCase() === extNameLower
    ) ?? get(graphEntities).find(
      (e) => e.name.toLowerCase() === extNameLower
    ) ?? graphEntityList.find(
      (e) => e.name.toLowerCase() === extNameLower
    );

    let entity: GraphEntity;
    const existingBatchIdx = existing ? graphEntityList.findIndex((e) => e.id === existing.id) : -1;

    if (existing) {
      entity = {
        ...existing,
        sourceNoteIds: existing.sourceNoteIds.includes(noteId)
          ? existing.sourceNoteIds
          : [...existing.sourceNoteIds, noteId],
        confidence: ext.confidence,
        subtype: ext.subtype ?? existing.subtype,
      };
    } else {
      entity = {
        id: uuidv4(),
        name: ext.name,
        type: ext.type,
        subtype: ext.subtype,
        sourceNoteIds: [noteId],
        confidence: ext.confidence,
      };
    }

    entityIdMap.set(key, entity.id);
    entityIdByName.set(extNameLower, entity.id);

    // If matched from current batch, update in place; otherwise add new
    if (existingBatchIdx >= 0) {
      graphEntityList[existingBatchIdx] = entity;
    } else {
      graphEntityList.push(entity);
    }

    // Save to DB
    await db.entities.put({
      id: entity.id,
      name: entity.name,
      type: entity.type,
      subtype: entity.subtype,
      sourceNoteIds: entity.sourceNoteIds,
    });
  }

  // Build relations with actual entity IDs (deduplicated via compound index)
  const graphRelationList: GraphRelation[] = [];
  for (const rel of extractedRelations) {
    const fromKey = findEntityKey(extracted, rel.fromName);
    const toKey = findEntityKey(extracted, rel.toName);
    // Try type::name key first, fall back to case-insensitive name lookup
    const fromId = (fromKey ? entityIdMap.get(fromKey) : undefined) ?? entityIdByName.get(rel.fromName.toLowerCase());
    const toId = (toKey ? entityIdMap.get(toKey) : undefined) ?? entityIdByName.get(rel.toName.toLowerCase());

    if (fromId && toId) {
      const provenance = {
        noteId,
        excerpt: relationExcerpt(content, rel.fromName, rel.toName, rel.excerpt),
        method: rel.method ?? 'regex' as const,
      };

      // Check if this exact relation already exists (compound index lookup)
      const existing = await db.relations
        .where('[fromEntityId+toEntityId+type]')
        .equals([fromId, toId, rel.type])
        .first();
      if (existing) {
        const existingProvenance = existing.provenance ?? [];
        const alreadyCaptured = existingProvenance.some(
          (item) => item.noteId === provenance.noteId && item.excerpt === provenance.excerpt
        );
        const enriched: GraphRelation = {
          id: existing.id,
          fromEntityId: existing.fromEntityId,
          toEntityId: existing.toEntityId,
          type: existing.type as GraphRelation['type'],
          weight: existing.weight ?? 1,
          confidence: existing.confidence ?? rel.confidence,
          accepted: existing.accepted ?? rel.method !== 'llm',
          rejected: existing.rejected ?? false,
          createdAt: existing.createdAt ?? Date.now(),
          updatedAt: Date.now(),
          provenance: alreadyCaptured ? existingProvenance as GraphRelation['provenance'] : [...existingProvenance, provenance] as GraphRelation['provenance'],
          metadata: existing.metadata,
        };
        await db.relations.put(persistableRelation(enriched));
        graphRelations.update((current) => current.map((item) => (item.id === enriched.id ? enriched : item)));
        continue;
      }

      const timestamp = Date.now();
      const relation: GraphRelation = {
        id: uuidv4(),
        fromEntityId: fromId,
        toEntityId: toId,
        type: rel.type,
        weight: 1,
        confidence: rel.confidence,
        accepted: rel.method !== 'llm',
        rejected: false,
        createdAt: timestamp,
        updatedAt: timestamp,
        provenance: [provenance],
      };
      graphRelationList.push(relation);

      await db.relations.put(persistableRelation(relation));
    }
  }

  // Cross-reference: scan content for mentions of existing note entities
  // This connects notes that reference each other by title in their content
  const thisNoteEntityId = entityIdByName.get(title.toLowerCase());
  const contentLower = content.toLowerCase();
  const allEntities = get(graphEntities);
  for (const entity of allEntities) {
    // Only match note entities, skip self, skip very short names (<=3 chars)
    if (entity.type !== 'note') continue;
    if (entity.name.toLowerCase() === title.toLowerCase()) continue;
    if (entity.name.length <= 3) continue;

    if (contentLower.includes(entity.name.toLowerCase())) {
      // This note's content mentions another note's title
      if (thisNoteEntityId) {
        const fromId = thisNoteEntityId;
        const toId = entity.id;
        const existing = await db.relations
          .where('[fromEntityId+toEntityId+type]')
          .equals([fromId, toId, 'mentions'])
          .first();
        if (!existing) {
          const timestamp = Date.now();
          const relation: GraphRelation = {
            id: uuidv4(),
            fromEntityId: fromId,
            toEntityId: toId,
            type: 'mentions',
            weight: 0.8,
            confidence: 0.8,
            accepted: true,
            rejected: false,
            createdAt: timestamp,
            updatedAt: timestamp,
            provenance: [
              {
                noteId,
                excerpt: relationExcerpt(content, title, entity.name),
                method: 'regex',
              },
            ],
          };
          graphRelationList.push(relation);
          await db.relations.put(persistableRelation(relation));
        }
      }
    }

    // Also check: does the other note's title appear to reference THIS note's title?
    // (reverse: if this note's title appears in an already-processed note, link them)
    // This is handled when the other note is processed, so no action needed here.
  }

  // Update stores by merging with existing (replacing entities that match)
  graphEntities.update((current) => {
    const updated = [...current];
    for (const newEntity of graphEntityList) {
      const idx = updated.findIndex((e) => e.id === newEntity.id);
      if (idx >= 0) {
        updated[idx] = newEntity;
      } else {
        updated.push(newEntity);
      }
    }
    return updated;
  });

  graphRelations.update((current) => [...current, ...graphRelationList]);

  rebuildVisData(get(graphEntities), get(graphRelations));
}

export async function addRelation(relation: GraphRelation): Promise<void> {
  graphRelations.update((current) => [...current, relation]);
  await db.relations.put(persistableRelation(relation));
  rebuildVisData(get(graphEntities), get(graphRelations));
}

export async function updateRelation(relationId: string, patch: Partial<GraphRelation>): Promise<void> {
  let updatedRelation: GraphRelation | undefined;
  graphRelations.update((current) =>
    current.map((relation) => {
      if (relation.id !== relationId) return relation;
      updatedRelation = { ...relation, ...patch, id: relation.id, updatedAt: Date.now() };
      return updatedRelation;
    })
  );

  if (updatedRelation) {
    await db.relations.put(persistableRelation(updatedRelation));
    rebuildVisData(get(graphEntities), get(graphRelations));
  }
}

export async function acceptRelation(relationId: string): Promise<void> {
  await updateRelation(relationId, { accepted: true, rejected: false });
}

export async function rejectRelation(relationId: string): Promise<void> {
  await updateRelation(relationId, { accepted: false, rejected: true });
  if (get(selectedEdgeId) === relationId) selectedEdgeId.set(null);
}

export async function removeRelation(relationId: string): Promise<void> {
  graphRelations.update((current) => current.filter((r) => r.id !== relationId));
  await db.relations.delete(relationId);
  rebuildVisData(get(graphEntities), get(graphRelations));
}

export async function mergeGraphEntities(keepId: string, removeId: string): Promise<void> {
  const entities = get(graphEntities);
  const relations = get(graphRelations);
  const keepEntity = entities.find((e) => e.id === keepId);
  const removeEntity = entities.find((e) => e.id === removeId);
  if (!keepEntity || !removeEntity) return;

  const { updatedRelations, mergedEntity } = mergeEntities(keepEntity, removeEntity, relations);

  graphEntities.update((current) =>
    current.filter((e) => e.id !== removeId).map((e) => (e.id === keepId ? mergedEntity : e))
  );
  graphRelations.set(updatedRelations);

  await db.entities.put({
    id: mergedEntity.id,
    name: mergedEntity.name,
    type: mergedEntity.type,
    subtype: mergedEntity.subtype,
    sourceNoteIds: mergedEntity.sourceNoteIds,
  });
  await db.entities.delete(removeId);
  // Persist updated relations
  for (const rel of updatedRelations) {
    await db.relations.put({
      id: rel.id,
      fromEntityId: rel.fromEntityId,
      toEntityId: rel.toEntityId,
      type: rel.type,
      weight: rel.weight ?? 1,
    });
  }

  rebuildVisData(get(graphEntities), get(graphRelations));
}

export async function unmergeGraphEntities(undoData: {
  keepEntity: GraphEntity;
  removeEntity: GraphEntity;
  originalRelations: GraphRelation[];
}): Promise<void> {
  const { keepEntity, removeEntity, originalRelations } = undoData;

  // Restore keep entity to original state, re-add remove entity
  graphEntities.update((current) => {
    const updated = current.map((e) => (e.id === keepEntity.id ? keepEntity : e));
    updated.push(removeEntity);
    return updated;
  });
  graphRelations.set(originalRelations);

  await db.entities.put({
    id: keepEntity.id,
    name: keepEntity.name,
    type: keepEntity.type,
    subtype: keepEntity.subtype,
    sourceNoteIds: keepEntity.sourceNoteIds,
  });
  await db.entities.put({
    id: removeEntity.id,
    name: removeEntity.name,
    type: removeEntity.type,
    subtype: removeEntity.subtype,
    sourceNoteIds: removeEntity.sourceNoteIds,
  });
  for (const rel of originalRelations) {
    await db.relations.put({
      id: rel.id,
      fromEntityId: rel.fromEntityId,
      toEntityId: rel.toEntityId,
      type: rel.type,
      weight: rel.weight ?? 1,
    });
  }

  rebuildVisData(get(graphEntities), get(graphRelations));
}

/**
 * Lazily expand transitive neighborhood for a single entity (on node click).
 * Runs single-origin BFS and adds discovered transitive relations to the graph.
 */
export async function expandEntityNeighborhood(entityId: string): Promise<void> {
  const entities = get(graphEntities);
  const relations = get(graphRelations);

  const candidates = findTransitiveCandidatesForEntity(entityId, entities, relations);
  if (candidates.length === 0) return;

  const newRelations: GraphRelation[] = [];
  for (const candidate of candidates) {
    // Check if relation already exists in store
    const exists = relations.some(
      (r) =>
        (r.fromEntityId === candidate.fromEntityId && r.toEntityId === candidate.toEntityId) ||
        (r.fromEntityId === candidate.toEntityId && r.toEntityId === candidate.fromEntityId)
    );
    if (exists) continue;

    const relation: GraphRelation = {
      id: uuidv4(),
      fromEntityId: candidate.fromEntityId,
      toEntityId: candidate.toEntityId,
      type: 'transitive',
      weight: candidate.inferredConfidence,
    };
    newRelations.push(relation);

    await db.relations.put({
      id: relation.id,
      fromEntityId: relation.fromEntityId,
      toEntityId: relation.toEntityId,
      type: relation.type,
      weight: relation.weight ?? 1,
    });
  }

  if (newRelations.length > 0) {
    graphRelations.update((current) => [...current, ...newRelations]);
    rebuildVisData(get(graphEntities), get(graphRelations));
  }
}

function findEntityKey(
  entities: { name: string; type: string }[],
  name: string
): string | undefined {
  const entity = entities.find((e) => e.name === name);
  return entity ? `${entity.type}::${entity.name}` : undefined;
}
