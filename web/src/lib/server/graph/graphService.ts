/**
 * Server-side knowledge graph service: materialized reads (cached), human
 * review actions on proposals and edges, transitive suggestions and feedback.
 */
import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';
import { getDb } from '../database';
import { readFolders, readNotes } from '../notesFile';
import { readGraphRelationReviews, upsertGraphRelationReview } from '../graphRelationReviews';
import { buildGraphRelationReviewKeyForRelation } from '../../graph/relationReviewKey';
import { findTransitiveCandidatesForEntity } from '../../graph/transitiveInference';
import type { GraphProposal, RelationProposalPayload } from '../../graph/proposals';
import type { GraphEdgeProvenance, GraphRelation } from '../../../types/graph';
import type { FolderRecord, NoteRecord } from '../../../types/note';
import { materializeGraph, reviewStateOf, type MaterializedGraph } from './materialize';
import {
  addEvalQuery,
  applyProposalRows,
  bumpOverlayRevision,
  insertProposal,
  markProposalRowsAccepted,
  overlayRevision,
  readOverlay,
  readOverlayRelationProposalId,
  readProposal,
  readProposalByKey,
  recordEdgeHelpful,
  revertProposalRows,
  updateOverlayRelationType,
  updateProposalStatus,
  updateRelationProposalType,
} from './graphStore';
import { relationDedupeKey } from './candidates';

type Db = Database.Database;

// ---------------------------------------------------------------------------
// Cached materialized graph
// ---------------------------------------------------------------------------
interface CacheEntry {
  signature: string;
  graph: MaterializedGraph;
}
const graphCache = new Map<string, CacheEntry>();
const MAX_CACHE_ENTRIES = 32;

function contentSignature(notes: NoteRecord[], folders: FolderRecord[]): string {
  const hash = createHash('sha1');
  for (const note of notes) {
    hash.update(`${note.id}|${note.version ?? ''}|${note.dateModified}|${note.folderId ?? ''}|${note.title.length}|${note.content.length}\n`);
  }
  for (const folder of folders) {
    hash.update(`f${folder.id}|${folder.name}|${folder.parentFolderId ?? ''}\n`);
  }
  return hash.digest('hex');
}

export function materializeForUser(input: {
  db: Db;
  userId: string;
  notes: NoteRecord[];
  folders: FolderRecord[];
  includePending?: boolean;
  useCache?: boolean;
}): MaterializedGraph {
  const signature = `${contentSignature(input.notes, input.folders)}|${overlayRevision(input.userId)}|${input.includePending ? 1 : 0}`;
  const cacheKey = `${input.userId}|${input.includePending ? 1 : 0}`;
  if (input.useCache !== false) {
    const cached = graphCache.get(cacheKey);
    if (cached && cached.signature === signature) return cached.graph;
  }
  const graph = materializeGraph({
    notes: input.notes,
    folders: input.folders,
    overlay: readOverlay(input.db, input.userId),
    reviews: readGraphRelationReviews(input.db, input.userId),
    includePending: input.includePending,
  });
  if (input.useCache !== false) {
    if (graphCache.size >= MAX_CACHE_ENTRIES) graphCache.delete(graphCache.keys().next().value!);
    graphCache.set(cacheKey, { signature, graph });
  }
  return graph;
}

export function getUserGraph(
  userId: string,
  options: { includePending?: boolean; notes?: NoteRecord[]; folders?: FolderRecord[] } = {}
): MaterializedGraph {
  return materializeForUser({
    db: getDb(),
    userId,
    notes: options.notes ?? readNotes(userId),
    folders: options.folders ?? readFolders(userId),
    includePending: options.includePending,
  });
}

export function invalidateUserGraph(userId: string): void {
  bumpOverlayRevision(userId);
}

// ---------------------------------------------------------------------------
// Proposal review actions
// ---------------------------------------------------------------------------
export type ProposalAction = 'accept' | 'reject' | 'undo';

export function reviewProposal(db: Db, userId: string, id: string, action: ProposalAction): GraphProposal | null {
  const proposal = readProposal(db, userId, id);
  if (!proposal) return null;
  const tx = db.transaction(() => {
    if (action === 'accept') {
      if (proposal.status === 'pending' || proposal.status === 'rejected' || proposal.status === 'undone') {
        applyProposalRows(db, userId, proposal, true);
      } else if (proposal.status === 'applied') {
        markProposalRowsAccepted(db, userId, proposal.id);
      }
      updateProposalStatus(db, userId, id, { status: 'applied', decidedBy: 'user', reviewOutcome: 'accepted' });
    } else if (action === 'reject') {
      // Rejecting something already in the graph reverts it; record it as undone so
      // metrics can tell "wrong change that was applied" from "refused proposal".
      const wasApplied = proposal.status === 'applied';
      if (wasApplied) revertProposalRows(db, userId, proposal.id);
      updateProposalStatus(db, userId, id, { status: wasApplied ? 'undone' : 'rejected', decidedBy: 'user', reviewOutcome: 'rejected' });
    } else if (action === 'undo') {
      if (proposal.status !== 'applied') return;
      revertProposalRows(db, userId, proposal.id);
      updateProposalStatus(db, userId, id, {
        status: 'undone',
        decidedBy: 'user',
        // Undoing an automatic change is a human verdict against it.
        reviewOutcome: proposal.decidedBy === 'auto' ? 'rejected' : null,
      });
    }
  });
  tx();
  bumpOverlayRevision(userId);
  return readProposal(db, userId, id);
}

/** Create (or re-apply) a relation the user explicitly asked for. */
export function createUserRelation(
  db: Db,
  userId: string,
  input: {
    fromKey: string;
    toKey: string;
    fromName: string;
    toName: string;
    type: GraphRelation['type'];
    source?: 'user' | 'transitive';
    provenance?: GraphEdgeProvenance[];
    metadata?: Record<string, unknown>;
  }
): GraphProposal | null {
  const dedupeKey = relationDedupeKey(input.type, input.fromKey, input.toKey);
  const payload: RelationProposalPayload = {
    fromKey: input.fromKey,
    toKey: input.toKey,
    fromName: input.fromName,
    toName: input.toName,
    type: input.type,
    provenance: input.provenance ?? [],
    metadata: input.metadata,
  };
  const inserted = insertProposal(db, userId, {
    dedupeKey,
    kind: 'relation',
    source: input.source ?? 'user',
    confidence: 1,
    description: `${input.fromName} —${input.type}→ ${input.toName} (added by you)`,
    payload,
    status: 'pending',
  });
  const proposal = inserted ?? readProposalByKey(db, userId, dedupeKey);
  if (!proposal) return null;
  return reviewProposal(db, userId, proposal.id, 'accept');
}

/**
 * Accept/reject/retype a materialized edge. Overlay and pending edges map to
 * their proposal; deterministic base edges use name-keyed relation reviews.
 */
export function reviewGraphEdge(
  db: Db,
  userId: string,
  input: {
    relationId: string;
    proposalId?: string | null;
    action: 'accept' | 'reject' | 'retype';
    type?: GraphRelation['type'];
  }
): { ok: boolean; proposal?: GraphProposal | null } {
  let proposalId = input.proposalId ?? null;
  if (!proposalId && input.relationId.startsWith('overlay:')) {
    proposalId = readOverlayRelationProposalId(db, userId, input.relationId.slice('overlay:'.length));
  }
  if (!proposalId && input.relationId.startsWith('proposal:')) {
    proposalId = input.relationId.slice('proposal:'.length);
  }

  if (proposalId) {
    const proposal = readProposal(db, userId, proposalId);
    if (!proposal) return { ok: false };
    if (input.action === 'retype') {
      if (proposal.kind !== 'relation' || !input.type) return { ok: false };
      const payload = { ...(proposal.payload as RelationProposalPayload), type: input.type };
      updateRelationProposalType(db, userId, proposal.id, payload, `${payload.fromName} —${payload.type}→ ${payload.toName}`);
      updateOverlayRelationType(db, userId, proposal.id, input.type);
      return { ok: true, proposal: reviewProposal(db, userId, proposal.id, 'accept') };
    }
    return { ok: true, proposal: reviewProposal(db, userId, proposal.id, input.action) };
  }

  // Base (deterministic) edge.
  const graph = getUserGraph(userId);
  const relation = graph.relations.find((item) => item.id === input.relationId);
  if (!relation) return { ok: false };
  const from = graph.entities.find((entity) => entity.id === relation.fromEntityId);
  const to = graph.entities.find((entity) => entity.id === relation.toEntityId);
  if (!from || !to) return { ok: false };

  const reviewKey = buildGraphRelationReviewKeyForRelation(relation, from, to);
  if (input.action === 'retype') {
    if (!input.type || input.type === relation.type) return { ok: false };
    upsertGraphRelationReview(db, userId, { reviewKey, fromName: from.name, toName: to.name, relationType: relation.type, accepted: false, rejected: true });
    const proposal = createUserRelation(db, userId, {
      fromKey: from.id,
      toKey: to.id,
      fromName: from.name,
      toName: to.name,
      type: input.type,
      provenance: relation.provenance?.map((item) => ({ ...item, method: 'user' as const })),
      metadata: { retypedFrom: relation.type },
    });
    bumpOverlayRevision(userId);
    return { ok: true, proposal };
  }
  upsertGraphRelationReview(db, userId, {
    reviewKey,
    fromName: from.name,
    toName: to.name,
    relationType: relation.type,
    accepted: input.action === 'accept',
    rejected: input.action === 'reject',
  });
  bumpOverlayRevision(userId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Transitive suggestions (ephemeral, never persisted unless accepted)
// ---------------------------------------------------------------------------
const STRUCTURAL_TYPES = new Set(['contains', 'child_of', 'transitive', 'related_to']);

export function transitiveSuggestions(graph: MaterializedGraph, entityId: string, limit = 10): GraphRelation[] {
  const entityById = new Map(graph.entities.map((entity) => [entity.id, entity]));
  // Only explicit or human-accepted edges: inferred edges never feed more inference.
  const trusted = graph.relations.filter((relation) => {
    if (relation.rejected) return false;
    const state = reviewStateOf(relation);
    if (state !== 'base' && state !== 'accepted') return false;
    if (STRUCTURAL_TYPES.has(relation.type)) return false;
    const from = entityById.get(relation.fromEntityId);
    const to = entityById.get(relation.toEntityId);
    return from?.type !== 'folder' && to?.type !== 'folder';
  });
  const existing = new Set(graph.relations.map((relation) => [relation.fromEntityId, relation.toEntityId].sort().join('::')));
  return findTransitiveCandidatesForEntity(entityId, graph.entities, trusted)
    .filter((candidate) => !existing.has([candidate.fromEntityId, candidate.toEntityId].sort().join('::')))
    .sort((a, b) => b.inferredConfidence - a.inferredConfidence)
    .slice(0, limit)
    .map((candidate) => ({
      id: `ephemeral:transitive:${candidate.fromEntityId}:${candidate.toEntityId}`,
      fromEntityId: candidate.fromEntityId,
      toEntityId: candidate.toEntityId,
      type: 'transitive' as const,
      confidence: Math.round(candidate.inferredConfidence * 1000) / 1000,
      weight: candidate.inferredConfidence,
      accepted: false,
      rejected: false,
      metadata: {
        reviewState: 'ephemeral',
        path: candidate.path,
        pathNames: candidate.path.map((id) => entityById.get(id)?.name ?? id),
        hops: candidate.hops,
      },
    }));
}

// ---------------------------------------------------------------------------
// Answer feedback
// ---------------------------------------------------------------------------
export function recordAnswerFeedback(
  db: Db,
  userId: string,
  input: { query?: string; noteId?: string; relationIds?: string[] }
): { evalAdded: boolean; edgesCredited: number } {
  const relationIds = (input.relationIds ?? []).filter((id) => typeof id === 'string' && id.length < 600).slice(0, 20);
  recordEdgeHelpful(db, userId, relationIds);
  let evalAdded = false;
  if (input.query && input.noteId) {
    evalAdded = addEvalQuery(db, userId, input.query, input.noteId, 'feedback');
  }
  return { evalAdded, edgesCredited: relationIds.length };
}
