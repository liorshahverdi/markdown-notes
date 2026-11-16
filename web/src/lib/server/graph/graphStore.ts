/**
 * SQLite persistence for the graph enrichment overlay.
 */
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type {
  GraphProposal,
  GraphProposalKind,
  GraphProposalSource,
  GraphProposalStatus,
  GraphRunSummary,
  MergeProposalPayload,
  NewEntityPayload,
  RelationProposalPayload,
  TypeCorrectionPayload,
} from '../../graph/proposals';
import type { AliasRow, CustomEntityRow, EdgeUsageRow, GraphOverlay, OverlayRelationRow, OverrideRow } from './materialize';

type Db = Database.Database;

// ---------------------------------------------------------------------------
// Overlay revision: bumped on every overlay write so cached graphs invalidate.
// ---------------------------------------------------------------------------
const overlayRevisions = new Map<string, number>();

export function overlayRevision(userId: string): number {
  return overlayRevisions.get(userId) ?? 0;
}

export function bumpOverlayRevision(userId: string): void {
  overlayRevisions.set(userId, overlayRevision(userId) + 1);
}

// ---------------------------------------------------------------------------
// Note processing state
// ---------------------------------------------------------------------------
export interface NoteStageState {
  noteId: string;
  stage: string;
  contentHash: string;
  processedAt: number;
  resultCount: number;
  attempts: number;
  error: string | null;
}

export function readNoteStates(db: Db, userId: string, stage: string): Map<string, NoteStageState> {
  const rows = db
    .prepare('SELECT noteId, stage, contentHash, processedAt, resultCount, attempts, error FROM graph_note_state WHERE userId = ? AND stage = ?')
    .all(userId, stage) as NoteStageState[];
  return new Map(rows.map((row) => [row.noteId, row]));
}

export function writeNoteState(
  db: Db,
  userId: string,
  state: { noteId: string; stage: string; contentHash: string; resultCount?: number; error?: string | null; attempts?: number }
): void {
  db.prepare(`
    INSERT INTO graph_note_state (userId, noteId, stage, contentHash, processedAt, resultCount, attempts, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(userId, noteId, stage) DO UPDATE SET
      contentHash = excluded.contentHash,
      processedAt = excluded.processedAt,
      resultCount = excluded.resultCount,
      attempts = excluded.attempts,
      error = excluded.error
  `).run(
    userId,
    state.noteId,
    state.stage,
    state.contentHash,
    Date.now(),
    state.resultCount ?? 0,
    state.attempts ?? 0,
    state.error ?? null
  );
}

export function clearNoteStates(db: Db, userId: string): void {
  db.prepare('DELETE FROM graph_note_state WHERE userId = ?').run(userId);
}

export function deleteNoteStates(db: Db, userId: string, noteId: string): void {
  db.prepare('DELETE FROM graph_note_state WHERE userId = ? AND noteId = ?').run(userId, noteId);
}

// ---------------------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------------------
interface ProposalRow {
  id: string;
  dedupeKey: string;
  kind: string;
  source: string;
  status: string;
  confidence: number;
  description: string;
  payloadJson: string;
  noteId: string | null;
  runId: string | null;
  createdAt: number;
  decidedAt: number | null;
  decidedBy: string | null;
  reviewOutcome: string | null;
}

function rowToProposal(row: ProposalRow): GraphProposal {
  return {
    id: row.id,
    dedupeKey: row.dedupeKey,
    kind: row.kind as GraphProposalKind,
    source: row.source as GraphProposalSource,
    status: row.status as GraphProposalStatus,
    confidence: row.confidence,
    description: row.description,
    payload: JSON.parse(row.payloadJson),
    noteId: row.noteId,
    runId: row.runId,
    createdAt: row.createdAt,
    decidedAt: row.decidedAt,
    decidedBy: row.decidedBy as GraphProposal['decidedBy'],
    reviewOutcome: row.reviewOutcome as GraphProposal['reviewOutcome'],
  };
}

const PROPOSAL_COLUMNS =
  'id, dedupeKey, kind, source, status, confidence, description, payloadJson, noteId, runId, createdAt, decidedAt, decidedBy, reviewOutcome';

export function readProposals(
  db: Db,
  userId: string,
  filter: { status?: GraphProposalStatus | GraphProposalStatus[]; kind?: GraphProposalKind; noteId?: string; limit?: number } = {}
): GraphProposal[] {
  const clauses = ['userId = ?'];
  const params: unknown[] = [userId];
  if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    clauses.push(`status IN (${statuses.map(() => '?').join(', ')})`);
    params.push(...statuses);
  }
  if (filter.kind) {
    clauses.push('kind = ?');
    params.push(filter.kind);
  }
  if (filter.noteId) {
    // Made from this note, or citing it in provenance (JSON.stringify emits no spaces).
    clauses.push('(noteId = ? OR instr(payloadJson, ?) > 0)');
    params.push(filter.noteId, `"noteId":${JSON.stringify(filter.noteId)}`);
  }
  const limit = filter.limit ? ` LIMIT ${Math.max(1, Math.floor(filter.limit))}` : '';
  const rows = db
    .prepare(`SELECT ${PROPOSAL_COLUMNS} FROM graph_proposals WHERE ${clauses.join(' AND ')} ORDER BY createdAt DESC${limit}`)
    .all(...params) as ProposalRow[];
  return rows.map(rowToProposal);
}

export function readProposal(db: Db, userId: string, id: string): GraphProposal | null {
  const row = db
    .prepare(`SELECT ${PROPOSAL_COLUMNS} FROM graph_proposals WHERE userId = ? AND id = ?`)
    .get(userId, id) as ProposalRow | undefined;
  return row ? rowToProposal(row) : null;
}

export function readProposalByKey(db: Db, userId: string, dedupeKey: string): GraphProposal | null {
  const row = db
    .prepare(`SELECT ${PROPOSAL_COLUMNS} FROM graph_proposals WHERE userId = ? AND dedupeKey = ?`)
    .get(userId, dedupeKey) as ProposalRow | undefined;
  return row ? rowToProposal(row) : null;
}

export function readOverlayRelationProposalId(db: Db, userId: string, overlayRowId: string): string | null {
  const row = db
    .prepare('SELECT proposalId FROM graph_overlay_relations WHERE userId = ? AND id = ?')
    .get(userId, overlayRowId) as { proposalId: string | null } | undefined;
  return row?.proposalId ?? null;
}

/** Every dedupe key ever proposed — including rejected/undone — so nothing is proposed twice. */
export function readProposalKeys(db: Db, userId: string): Set<string> {
  const rows = db.prepare('SELECT dedupeKey FROM graph_proposals WHERE userId = ?').all(userId) as Array<{ dedupeKey: string }>;
  return new Set(rows.map((row) => row.dedupeKey));
}

export function insertProposal(
  db: Db,
  userId: string,
  proposal: Omit<GraphProposal, 'id' | 'createdAt' | 'status'> & { status?: GraphProposalStatus }
): GraphProposal | null {
  const id = randomUUID();
  const createdAt = Date.now();
  const result = db.prepare(`
    INSERT OR IGNORE INTO graph_proposals (${PROPOSAL_COLUMNS}, userId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    proposal.dedupeKey,
    proposal.kind,
    proposal.source,
    proposal.status ?? 'pending',
    proposal.confidence,
    proposal.description,
    JSON.stringify(proposal.payload),
    proposal.noteId ?? null,
    proposal.runId ?? null,
    createdAt,
    proposal.decidedAt ?? null,
    proposal.decidedBy ?? null,
    proposal.reviewOutcome ?? null,
    userId
  );
  if (result.changes === 0) return null;
  return readProposal(db, userId, id);
}

export function updateProposalStatus(
  db: Db,
  userId: string,
  id: string,
  patch: { status: GraphProposalStatus; decidedBy?: 'auto' | 'user'; reviewOutcome?: 'accepted' | 'rejected' | null }
): void {
  db.prepare(`
    UPDATE graph_proposals
    SET status = ?, decidedAt = ?, decidedBy = COALESCE(?, decidedBy), reviewOutcome = COALESCE(?, reviewOutcome)
    WHERE userId = ? AND id = ?
  `).run(patch.status, Date.now(), patch.decidedBy ?? null, patch.reviewOutcome ?? null, userId, id);
}

export function updateRelationProposalType(db: Db, userId: string, id: string, payload: RelationProposalPayload, description: string): void {
  db.prepare('UPDATE graph_proposals SET payloadJson = ?, description = ? WHERE userId = ? AND id = ?')
    .run(JSON.stringify(payload), description, userId, id);
}

/** Human review counts per source, used to calibrate auto-apply thresholds. */
export function readReviewStats(db: Db, userId: string): Map<string, { accepted: number; rejected: number }> {
  const rows = db.prepare(`
    SELECT source,
      SUM(CASE WHEN reviewOutcome = 'accepted' THEN 1 ELSE 0 END) AS accepted,
      SUM(CASE WHEN reviewOutcome = 'rejected' THEN 1 ELSE 0 END) AS rejected
    FROM graph_proposals WHERE userId = ? GROUP BY source
  `).all(userId) as Array<{ source: string; accepted: number; rejected: number }>;
  return new Map(rows.map((row) => [row.source, { accepted: row.accepted ?? 0, rejected: row.rejected ?? 0 }]));
}

// ---------------------------------------------------------------------------
// Applying / reverting a proposal (each op stores its own inverse: rows keyed by proposalId)
// ---------------------------------------------------------------------------
export function applyProposalRows(db: Db, userId: string, proposal: GraphProposal, byUser: boolean): void {
  const now = Date.now();
  const status = byUser ? 'accepted' : 'auto';
  if (proposal.kind === 'relation') {
    const payload = proposal.payload as RelationProposalPayload;
    db.prepare(`
      INSERT INTO graph_overlay_relations (id, userId, proposalId, fromKey, toKey, type, confidence, method, status, provenanceJson, metadataJson, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      userId,
      proposal.id,
      payload.fromKey,
      payload.toKey,
      payload.type,
      proposal.confidence,
      proposal.source === 'user' ? 'user' : proposal.source === 'cooccurrence' || proposal.source === 'transitive' ? 'cooccurrence' : 'llm',
      status,
      JSON.stringify(payload.provenance ?? []),
      JSON.stringify({ ...(payload.metadata ?? {}), source: proposal.source }),
      now,
      now
    );
  } else if (proposal.kind === 'merge') {
    const payload = proposal.payload as MergeProposalPayload;
    db.prepare(`
      INSERT OR REPLACE INTO graph_entity_aliases (userId, aliasKey, canonicalKey, proposalId, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, payload.removeKey, payload.keepKey, proposal.id, now);
  } else if (proposal.kind === 'type_correction') {
    const payload = proposal.payload as TypeCorrectionPayload;
    db.prepare(`
      INSERT OR REPLACE INTO graph_entity_overrides (userId, entityKey, type, subtype, proposalId)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, payload.entityKey, payload.newType, payload.newSubtype ?? null, proposal.id);
  } else if (proposal.kind === 'new_entity') {
    const payload = proposal.payload as NewEntityPayload;
    db.prepare(`
      INSERT OR REPLACE INTO graph_custom_entities (userId, entityKey, noteId, name, type, subtype, proposalId, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, payload.entityKey, payload.noteId, payload.name, payload.type, payload.subtype ?? null, proposal.id, status);
  }
  bumpOverlayRevision(userId);
}

export function markProposalRowsAccepted(db: Db, userId: string, proposalId: string): void {
  db.prepare("UPDATE graph_overlay_relations SET status = 'accepted', updatedAt = ? WHERE userId = ? AND proposalId = ?")
    .run(Date.now(), userId, proposalId);
  db.prepare("UPDATE graph_custom_entities SET status = 'accepted' WHERE userId = ? AND proposalId = ?").run(userId, proposalId);
  bumpOverlayRevision(userId);
}

export function revertProposalRows(db: Db, userId: string, proposalId: string): void {
  db.prepare('DELETE FROM graph_overlay_relations WHERE userId = ? AND proposalId = ?').run(userId, proposalId);
  db.prepare('DELETE FROM graph_entity_aliases WHERE userId = ? AND proposalId = ?').run(userId, proposalId);
  db.prepare('DELETE FROM graph_entity_overrides WHERE userId = ? AND proposalId = ?').run(userId, proposalId);
  db.prepare('DELETE FROM graph_custom_entities WHERE userId = ? AND proposalId = ?').run(userId, proposalId);
  bumpOverlayRevision(userId);
}

export function updateOverlayRelationType(db: Db, userId: string, proposalId: string, type: string): void {
  db.prepare('UPDATE graph_overlay_relations SET type = ?, updatedAt = ? WHERE userId = ? AND proposalId = ?')
    .run(type, Date.now(), userId, proposalId);
  bumpOverlayRevision(userId);
}

// ---------------------------------------------------------------------------
// Overlay read
// ---------------------------------------------------------------------------
export function readOverlay(db: Db, userId: string): GraphOverlay {
  const relations = (db.prepare(`
    SELECT id, proposalId, fromKey, toKey, type, confidence, method, status, provenanceJson, metadataJson, createdAt, updatedAt
    FROM graph_overlay_relations WHERE userId = ?
  `).all(userId) as Array<Omit<OverlayRelationRow, 'provenance' | 'metadata'> & { provenanceJson: string; metadataJson: string | null }>)
    .map(({ provenanceJson, metadataJson, ...row }) => ({
      ...row,
      provenance: JSON.parse(provenanceJson || '[]'),
      metadata: metadataJson ? JSON.parse(metadataJson) : null,
    })) as OverlayRelationRow[];
  const aliases = db.prepare('SELECT aliasKey, canonicalKey, proposalId FROM graph_entity_aliases WHERE userId = ?').all(userId) as AliasRow[];
  const overrides = db.prepare('SELECT entityKey, type, subtype FROM graph_entity_overrides WHERE userId = ?').all(userId) as OverrideRow[];
  const customEntities = db.prepare(
    'SELECT entityKey, noteId, name, type, subtype, status, proposalId FROM graph_custom_entities WHERE userId = ?'
  ).all(userId) as CustomEntityRow[];
  const pendingRelations = readProposals(db, userId, { status: 'pending', kind: 'relation' });
  const usageRows = db.prepare(
    'SELECT relationId, useCount, helpfulCount, unhelpfulCount, lastUsedAt, lastHelpfulAt FROM graph_edge_usage WHERE userId = ?'
  ).all(userId) as EdgeUsageRow[];
  return {
    relations,
    aliases,
    overrides,
    customEntities,
    pendingRelations,
    usage: new Map(usageRows.map((row) => [row.relationId, row])),
  };
}

// ---------------------------------------------------------------------------
// Usage / feedback / eval
// ---------------------------------------------------------------------------
export function recordEdgeUsage(db: Db, userId: string, relationIds: string[]): void {
  if (relationIds.length === 0) return;
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO graph_edge_usage (userId, relationId, useCount, helpfulCount, lastUsedAt)
    VALUES (?, ?, 1, 0, ?)
    ON CONFLICT(userId, relationId) DO UPDATE SET useCount = useCount + 1, lastUsedAt = excluded.lastUsedAt
  `);
  const tx = db.transaction((ids: string[]) => {
    for (const id of new Set(ids)) stmt.run(userId, id, now);
  });
  tx(relationIds);
  // Usage changes effective weights, but only slowly; no cache bump needed per query.
}

export function recordEdgeHelpful(db: Db, userId: string, relationIds: string[]): void {
  if (relationIds.length === 0) return;
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO graph_edge_usage (userId, relationId, useCount, helpfulCount, lastUsedAt, lastHelpfulAt)
    VALUES (?, ?, 1, 1, ?, ?)
    ON CONFLICT(userId, relationId) DO UPDATE SET helpfulCount = helpfulCount + 1, lastHelpfulAt = excluded.lastHelpfulAt, lastUsedAt = excluded.lastUsedAt
  `);
  const tx = db.transaction((ids: string[]) => {
    for (const id of new Set(ids)) stmt.run(userId, id, now, now);
  });
  tx(relationIds);
  bumpOverlayRevision(userId);
}

export function recordEdgeUnhelpful(db: Db, userId: string, relationIds: string[]): void {
  if (relationIds.length === 0) return;
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO graph_edge_usage (userId, relationId, useCount, helpfulCount, unhelpfulCount, lastUsedAt)
    VALUES (?, ?, 1, 0, 1, ?)
    ON CONFLICT(userId, relationId) DO UPDATE SET unhelpfulCount = unhelpfulCount + 1, lastUsedAt = excluded.lastUsedAt
  `);
  const tx = db.transaction((ids: string[]) => {
    for (const id of new Set(ids)) stmt.run(userId, id, now);
  });
  tx(relationIds);
  bumpOverlayRevision(userId);
}

export interface EvalQuery {
  id: string;
  query: string;
  expectedNoteId: string;
  source: 'feedback' | 'manual';
  createdAt: number;
}

export function addEvalQuery(db: Db, userId: string, query: string, expectedNoteId: string, source: EvalQuery['source']): boolean {
  const normalized = query.trim().replace(/\s+/g, ' ');
  if (!normalized || normalized.length > 500) return false;
  const result = db.prepare(`
    INSERT OR IGNORE INTO graph_eval_queries (id, userId, query, expectedNoteId, source, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), userId, normalized, expectedNoteId, source, Date.now());
  return result.changes > 0;
}

export function readEvalQueries(db: Db, userId: string, limit = 200): EvalQuery[] {
  return db.prepare(
    `SELECT id, query, expectedNoteId, source, createdAt FROM graph_eval_queries WHERE userId = ? ORDER BY createdAt DESC LIMIT ${Math.max(1, Math.floor(limit))}`
  ).all(userId) as EvalQuery[];
}

export function deleteEvalQuery(db: Db, userId: string, id: string): boolean {
  return db.prepare('DELETE FROM graph_eval_queries WHERE userId = ? AND id = ?').run(userId, id).changes > 0;
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------
export function startRun(db: Db, userId: string, trigger: string): string {
  const id = randomUUID();
  db.prepare(`INSERT INTO graph_runs (id, userId, trigger, status, startedAt) VALUES (?, ?, ?, 'running', ?)`)
    .run(id, userId, trigger, Date.now());
  return id;
}

export function finishRun(
  db: Db,
  userId: string,
  id: string,
  result: Pick<GraphRunSummary, 'status' | 'stats' | 'metrics' | 'error'> & {
    evalBefore?: GraphRunSummary['evalBefore'];
    evalAfter?: GraphRunSummary['evalAfter'];
    gateReverted?: number;
  }
): void {
  db.prepare(`
    UPDATE graph_runs SET status = ?, finishedAt = ?, statsJson = ?, evalJson = ?, metricsJson = ?, error = ?
    WHERE userId = ? AND id = ?
  `).run(
    result.status,
    Date.now(),
    JSON.stringify(result.stats ?? {}),
    JSON.stringify({ before: result.evalBefore ?? null, after: result.evalAfter ?? null, gateReverted: result.gateReverted ?? 0 }),
    result.metrics ? JSON.stringify(result.metrics) : null,
    result.error ?? null,
    userId,
    id
  );
}

export function readRuns(db: Db, userId: string, limit = 10): GraphRunSummary[] {
  const rows = db.prepare(
    `SELECT id, trigger, status, startedAt, finishedAt, statsJson, evalJson, metricsJson, error FROM graph_runs WHERE userId = ? ORDER BY startedAt DESC LIMIT ${Math.max(1, Math.floor(limit))}`
  ).all(userId) as Array<{
    id: string; trigger: string; status: string; startedAt: number; finishedAt: number | null;
    statsJson: string; evalJson: string | null; metricsJson: string | null; error: string | null;
  }>;
  return rows.map((row) => {
    const evalData = row.evalJson ? JSON.parse(row.evalJson) : {};
    return {
      id: row.id,
      trigger: row.trigger,
      status: row.status as GraphRunSummary['status'],
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      stats: JSON.parse(row.statsJson || '{}'),
      evalBefore: evalData.before ?? null,
      evalAfter: evalData.after ?? null,
      gateReverted: evalData.gateReverted ?? 0,
      metrics: row.metricsJson ? JSON.parse(row.metricsJson) : null,
      error: row.error,
    };
  });
}

/** Mark runs left "running" by a crashed/restarted process as failed. */
export function failStaleRuns(db: Db, olderThanMs: number): void {
  db.prepare(`UPDATE graph_runs SET status = 'failed', finishedAt = ?, error = 'interrupted' WHERE status = 'running' AND startedAt < ?`)
    .run(Date.now(), Date.now() - olderThanMs);
}
