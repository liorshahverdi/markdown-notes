/**
 * Materialize the per-user knowledge graph:
 *   base graph (recomputed from current notes)
 *   + aliases (merges), type overrides, model-found entities
 *   + overlay relations (auto-applied or user-accepted)
 *   + optional pending proposals (for review UIs only)
 *   + relation reviews and usage-based decay.
 *
 * Pure function so it can be unit tested without SQLite.
 */
import { buildBaseGraph, entityKeyFor } from '../graphSnapshot';
import { applyGraphRelationReview, type GraphRelationReviewMap } from '../../graph/relationReviewKey';
import { detectClusters } from '../../skills/clusterDetector';
import type { GraphProposal, RelationProposalPayload, RelationReviewState } from '../../graph/proposals';
import type { EntityType, GraphEdgeProvenance, GraphEntity, GraphRelation } from '../../../types/graph';
import type { FolderRecord, NoteRecord } from '../../../types/note';

export interface OverlayRelationRow {
  id: string;
  proposalId: string | null;
  fromKey: string;
  toKey: string;
  type: GraphRelation['type'];
  confidence: number;
  method: GraphEdgeProvenance['method'];
  status: 'auto' | 'accepted';
  provenance: GraphEdgeProvenance[];
  metadata?: Record<string, unknown> | null;
  createdAt: number;
  updatedAt: number;
}

export interface AliasRow {
  aliasKey: string;
  canonicalKey: string;
  proposalId?: string | null;
}

export interface OverrideRow {
  entityKey: string;
  type: EntityType;
  subtype?: string | null;
}

export interface CustomEntityRow {
  entityKey: string;
  noteId: string;
  name: string;
  type: EntityType;
  subtype?: string | null;
  status: 'auto' | 'accepted';
  proposalId?: string | null;
}

export interface EdgeUsageRow {
  relationId: string;
  useCount: number;
  helpfulCount: number;
  lastUsedAt?: number | null;
  lastHelpfulAt?: number | null;
}

export interface GraphOverlay {
  relations: OverlayRelationRow[];
  aliases: AliasRow[];
  overrides: OverrideRow[];
  customEntities: CustomEntityRow[];
  pendingRelations: GraphProposal[];
  usage: Map<string, EdgeUsageRow>;
}

export const EMPTY_OVERLAY: GraphOverlay = {
  relations: [],
  aliases: [],
  overrides: [],
  customEntities: [],
  pendingRelations: [],
  usage: new Map(),
};

export interface MaterializedGraph {
  entities: GraphEntity[];
  relations: GraphRelation[];
  clusters: ReturnType<typeof detectClusters>;
  /** Resolve an entity key through merges to the key used in this graph. */
  resolveKey: (key: string) => string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DECAY_GRACE_DAYS = 30;

const STATE_PRIORITY: Record<RelationReviewState, number> = {
  accepted: 4,
  base: 3,
  auto: 2,
  pending: 1,
  ephemeral: 0,
};

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function reviewStateOf(relation: GraphRelation): RelationReviewState {
  const state = relation.metadata?.reviewState;
  if (state === 'accepted' || state === 'base' || state === 'auto' || state === 'pending' || state === 'ephemeral') {
    return state;
  }
  return relation.accepted ? 'accepted' : 'base';
}

/**
 * Usage-aware weight: helpful citations boost an edge; unreviewed automatic
 * edges that nobody uses decay after a grace period (never below 25%).
 */
export function effectiveEdgeWeight(input: {
  confidence?: number;
  reviewState: RelationReviewState;
  usage?: EdgeUsageRow;
  createdAt?: number;
  now: number;
}): number {
  let weight = input.confidence ?? 0.75;
  const helpful = input.usage?.helpfulCount ?? 0;
  if (helpful > 0) {
    weight = Math.min(1, weight + 0.05 * Math.min(helpful, 4));
  } else if (input.reviewState === 'auto') {
    const lastActive = Math.max(input.usage?.lastUsedAt ?? 0, input.createdAt ?? input.now);
    const idleDays = (input.now - lastActive) / DAY_MS;
    if (idleDays > DECAY_GRACE_DAYS) {
      weight *= Math.max(0.25, Math.pow(0.5, (idleDays - DECAY_GRACE_DAYS) / DECAY_GRACE_DAYS));
    }
  }
  return Math.round(weight * 1000) / 1000;
}

function buildAliasResolver(aliases: AliasRow[]): (key: string) => string {
  const map = new Map(aliases.map((alias) => [alias.aliasKey, alias.canonicalKey]));
  return (key: string) => {
    let current = key;
    const seen = new Set<string>();
    while (map.has(current) && !seen.has(current)) {
      seen.add(current);
      current = map.get(current)!;
    }
    return current;
  };
}

function mergeProvenance(a: GraphEdgeProvenance[] = [], b: GraphEdgeProvenance[] = []): GraphEdgeProvenance[] {
  const out = [...a];
  for (const item of b) {
    if (!out.some((existing) => existing.noteId === item.noteId && existing.excerpt === item.excerpt)) {
      out.push(item);
    }
  }
  return out;
}

export function materializeGraph(input: {
  notes: NoteRecord[];
  folders: FolderRecord[];
  overlay?: GraphOverlay;
  reviews?: GraphRelationReviewMap;
  includePending?: boolean;
  now?: number;
}): MaterializedGraph {
  const overlay = input.overlay ?? EMPTY_OVERLAY;
  const now = input.now ?? Date.now();
  const noteById = new Map(input.notes.map((note) => [note.id, note]));
  const noteText = new Map(input.notes.map((note) => [note.id, normalizeText(`${note.title}\n${note.content}`)]));
  const base = buildBaseGraph(input.notes, input.folders);

  // --- entities -----------------------------------------------------------
  const entityMap = new Map<string, GraphEntity>();
  for (const entity of base.entities) entityMap.set(entity.id, { ...entity, sourceNoteIds: [...entity.sourceNoteIds] });

  const customRelations: GraphRelation[] = [];
  for (const custom of overlay.customEntities) {
    const note = noteById.get(custom.noteId);
    if (!note) continue; // note deleted → model-found entity disappears
    if (custom.status !== 'accepted' && !noteText.get(note.id)!.includes(normalizeText(custom.name))) continue;
    const existing = entityMap.get(custom.entityKey);
    if (existing) {
      if (!existing.sourceNoteIds.includes(note.id)) existing.sourceNoteIds.push(note.id);
    } else {
      entityMap.set(custom.entityKey, {
        id: custom.entityKey,
        name: custom.name,
        type: custom.type,
        subtype: custom.subtype ?? undefined,
        sourceNoteIds: [note.id],
        confidence: 0.7,
      });
    }
    customRelations.push({
      id: `mentioned_in:${custom.entityKey}:note:${note.id}`,
      fromEntityId: custom.entityKey,
      toEntityId: `note:${note.id}`,
      type: 'mentioned_in',
      confidence: 0.7,
      accepted: custom.status === 'accepted',
      provenance: [{ noteId: note.id, method: 'llm' }],
      metadata: { reviewState: custom.status === 'accepted' ? 'accepted' : 'auto', proposalId: custom.proposalId ?? undefined },
    });
  }

  for (const override of overlay.overrides) {
    const entity = entityMap.get(override.entityKey);
    if (!entity || entity.type === 'note' || entity.type === 'folder') continue;
    entity.type = override.type;
    entity.subtype = override.subtype ?? undefined;
  }

  // Merges: only follow aliases whose canonical entity still exists.
  const validAliases = overlay.aliases.filter(
    (alias) => alias.aliasKey !== alias.canonicalKey && entityMap.has(alias.canonicalKey) && entityMap.has(alias.aliasKey)
  );
  const resolveKey = buildAliasResolver(validAliases);
  for (const alias of validAliases) {
    const canonicalKey = resolveKey(alias.aliasKey);
    const canonical = entityMap.get(canonicalKey);
    const removed = entityMap.get(alias.aliasKey);
    if (!canonical || !removed || canonical === removed) continue;
    for (const noteId of removed.sourceNoteIds) {
      if (!canonical.sourceNoteIds.includes(noteId)) canonical.sourceNoteIds.push(noteId);
    }
    entityMap.delete(alias.aliasKey);
  }

  // --- relations ------------------------------------------------------------
  const candidates: GraphRelation[] = [];
  for (const relation of [...base.relations, ...customRelations]) candidates.push(relation);

  for (const row of overlay.relations) {
    const fromKey = resolveKey(row.fromKey);
    const toKey = resolveKey(row.toKey);
    const from = entityMap.get(fromKey);
    const to = entityMap.get(toKey);
    if (!from || !to) continue;
    const provenance = row.provenance.filter((item) => {
      const text = noteText.get(item.noteId);
      if (!text) return false;
      if (row.status === 'accepted') return true;
      if (item.excerpt) return text.includes(normalizeText(item.excerpt));
      return from.sourceNoteIds.includes(item.noteId) && to.sourceNoteIds.includes(item.noteId);
    });
    if (row.status !== 'accepted' && row.provenance.length > 0 && provenance.length === 0) continue;
    candidates.push({
      id: `overlay:${row.id}`,
      fromEntityId: fromKey,
      toEntityId: toKey,
      type: row.type,
      confidence: row.confidence,
      accepted: row.status === 'accepted',
      rejected: false,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      provenance,
      metadata: {
        ...(row.metadata ?? {}),
        reviewState: row.status === 'accepted' ? 'accepted' : 'auto',
        proposalId: row.proposalId ?? undefined,
        method: row.method,
      },
    });
  }

  if (input.includePending) {
    for (const proposal of overlay.pendingRelations) {
      if (proposal.kind !== 'relation' || proposal.status !== 'pending') continue;
      const payload = proposal.payload as RelationProposalPayload;
      const fromKey = resolveKey(payload.fromKey);
      const toKey = resolveKey(payload.toKey);
      if (!entityMap.has(fromKey) || !entityMap.has(toKey) || fromKey === toKey) continue;
      candidates.push({
        id: `proposal:${proposal.id}`,
        fromEntityId: fromKey,
        toEntityId: toKey,
        type: payload.type,
        confidence: proposal.confidence,
        accepted: false,
        rejected: false,
        createdAt: proposal.createdAt,
        updatedAt: proposal.createdAt,
        provenance: payload.provenance.filter((item) => noteById.has(item.noteId)),
        metadata: { ...(payload.metadata ?? {}), reviewState: 'pending', proposalId: proposal.id, source: proposal.source },
      });
    }
  }

  // Remap through merges, drop self-loops, collapse duplicates.
  const collapsed = new Map<string, GraphRelation>();
  for (const relation of candidates) {
    const fromEntityId = resolveKey(relation.fromEntityId);
    const toEntityId = resolveKey(relation.toEntityId);
    if (fromEntityId === toEntityId) continue;
    if (!entityMap.has(fromEntityId) || !entityMap.has(toEntityId)) continue;
    const remapped = fromEntityId !== relation.fromEntityId || toEntityId !== relation.toEntityId;
    const next: GraphRelation = {
      ...relation,
      id: remapped && !relation.id.startsWith('overlay:') && !relation.id.startsWith('proposal:')
        ? `${relation.type}:${fromEntityId}:${toEntityId}`
        : relation.id,
      fromEntityId,
      toEntityId,
    };
    const key = `${next.type}|${fromEntityId}|${toEntityId}`;
    const existing = collapsed.get(key);
    if (!existing) {
      collapsed.set(key, next);
      continue;
    }
    const keepNext = STATE_PRIORITY[reviewStateOf(next)] > STATE_PRIORITY[reviewStateOf(existing)];
    const winner = keepNext ? next : existing;
    const loser = keepNext ? existing : next;
    collapsed.set(key, {
      ...winner,
      confidence: Math.max(winner.confidence ?? 0, loser.confidence ?? 0) || winner.confidence,
      provenance: mergeProvenance(winner.provenance, loser.provenance),
    });
  }

  const entities = Array.from(entityMap.values());
  const relations: GraphRelation[] = [];
  for (const relation of collapsed.values()) {
    const from = entityMap.get(relation.fromEntityId)!;
    const to = entityMap.get(relation.toEntityId)!;
    let reviewed = relation;
    if (reviewStateOf(relation) === 'base') {
      reviewed = applyGraphRelationReview(relation, from, to, input.reviews);
      if (reviewed.accepted && reviewed !== relation) {
        reviewed = { ...reviewed, metadata: { ...(reviewed.metadata ?? {}), reviewState: 'accepted' } };
      } else if (reviewed !== relation) {
        // A review that only clears acceptance keeps base semantics.
        reviewed = { ...reviewed, accepted: reviewed.accepted ?? relation.accepted };
      }
    }
    const usage = overlay.usage.get(reviewed.id);
    const reviewState = reviewStateOf(reviewed);
    relations.push({
      ...reviewed,
      weight: effectiveEdgeWeight({
        confidence: reviewed.confidence,
        reviewState,
        usage,
        createdAt: reviewed.createdAt,
        now,
      }),
      metadata: {
        ...(reviewed.metadata ?? {}),
        reviewState,
        ...(usage ? { useCount: usage.useCount, helpfulCount: usage.helpfulCount } : {}),
      },
    });
  }

  return {
    entities,
    relations,
    clusters: detectClusters(entities, relations.filter((relation) => !relation.rejected && reviewStateOf(relation) !== 'pending')),
    resolveKey,
  };
}

export { entityKeyFor };
