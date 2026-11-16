/**
 * Server-side enrichment loop.
 *
 * One pass:
 *   1. materialize the current graph (base + overlay)
 *   2. rule stages: co-occurrence links (NPMI) and same-type duplicates
 *   3. model stages on changed notes first (implicit relations, type checks,
 *      missed entities), bounded by a per-pass budget, tracked per note+stage
 *      by content hash so every note eventually gets processed
 *   4. auto-apply proposals that clear calibrated per-source thresholds
 *   5. retrieval regression gate: revert this pass's auto-applies if the saved
 *      question set gets worse
 *   6. record run stats and quality metrics
 *
 * Triggered by note saves (debounced), a periodic scheduler and manual runs.
 * Passes are serialized globally so the shared model is never hit in parallel.
 */
import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';
import { getDb } from '../database';
import { readFolders, readNotes } from '../notesFile';
import { checkLlamaCppHealth, completeLlamaCpp } from '../llamaCpp';
import type {
  GraphProposal,
  GraphProposalSource,
  GraphRunSummary,
  MergeProposalPayload,
  NewEntityPayload,
  RelationProposalPayload,
  RetrievalEvalResult,
  TypeCorrectionPayload,
} from '../../graph/proposals';
import type { FolderRecord, NoteRecord } from '../../../types/note';
import {
  BASE_THRESHOLDS,
  calibrateThreshold,
  findCooccurrenceCandidates,
  findDuplicateCandidates,
  mergeDedupeKey,
  newEntityDedupeKey,
  pairKey,
  relationDedupeKey,
  typeCorrectionDedupeKey,
  type CalibratedThreshold,
} from './candidates';
import {
  applyProposalRows,
  bumpOverlayRevision,
  failStaleRuns,
  finishRun,
  insertProposal,
  readEvalQueries,
  readNoteStates,
  readProposals,
  readReviewStats,
  revertProposalRows,
  startRun,
  updateProposalStatus,
  writeNoteState,
} from './graphStore';
import { computeGraphQualityMetrics, retrievalRegressed, runRetrievalEval } from './graphEval';
import {
  buildImplicitRelationPrompt,
  buildValidationPrompt,
  confirmMerge,
  parseImplicitRelations,
  parseJsonLoose,
  parseValidation,
  relevantEntitiesForNote,
  type CompleteJson,
} from './llmEnrichment';
import { materializeForUser } from './graphService';

type Db = Database.Database;

export interface LlmDeps {
  healthy: () => Promise<boolean>;
  complete: CompleteJson;
}

export interface GraphPassOptions {
  db: Db;
  userId: string;
  notes: NoteRecord[];
  folders: FolderRecord[];
  trigger: string;
  llm?: LlmDeps | null;
  llmNoteBudget?: number;
  mergeConfirmBudget?: number;
  configuredThreshold?: number;
  /** Override for tests; defaults to recall/MRR drop detection. */
  regressionCheck?: (before: RetrievalEvalResult, after: RetrievalEvalResult) => boolean;
}

const MAX_LLM_ATTEMPTS = 3;
const STAGE_IMPLICIT = 'llm_implicit';
const STAGE_VALIDATE = 'llm_validate';

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export function noteContentHash(note: NoteRecord): string {
  return createHash('sha1').update(`${note.title}\n${note.folderId ?? ''}\n${note.content}`).digest('hex');
}

function needsStage(state: { contentHash: string; attempts: number } | undefined, hash: string): boolean {
  if (!state) return true;
  return state.contentHash !== hash;
}

function proposalEligible(proposal: GraphProposal, thresholds: Map<GraphProposalSource, CalibratedThreshold>): boolean {
  const threshold = thresholds.get(proposal.source)?.threshold ?? Infinity;
  if (proposal.confidence < threshold) return false;
  if (proposal.kind === 'relation') {
    const payload = proposal.payload as RelationProposalPayload;
    if (payload.evidenceVerified === false) return false;
  }
  if (proposal.kind === 'merge') {
    return (proposal.payload as MergeProposalPayload).llmConfirmed === true;
  }
  if (proposal.kind === 'type_correction') return false;
  return true;
}

export async function runGraphPass(options: GraphPassOptions): Promise<GraphRunSummary> {
  const { db, userId, notes, folders } = options;
  const runId = startRun(db, userId, options.trigger);
  const startedAt = Date.now();
  const stats: Record<string, number | string | boolean> = {
    notes: notes.length,
    changedNotes: 0,
    cooccurrenceProposals: 0,
    duplicateProposals: 0,
    implicitProposals: 0,
    typeProposals: 0,
    missedEntityProposals: 0,
    llmNotesProcessed: 0,
    llmErrors: 0,
    llmAvailable: false,
    autoApplied: 0,
  };
  try {
    const graph = materializeForUser({ db, userId, notes, folders, useCache: false });
    const allProposals = readProposals(db, userId);
    const proposedRelationPairs = new Set<string>();
    const proposedMergePairs = new Set<string>();
    for (const proposal of allProposals) {
      if (proposal.kind === 'relation') {
        const payload = proposal.payload as RelationProposalPayload;
        proposedRelationPairs.add(pairKey(payload.fromKey, payload.toKey));
      } else if (proposal.kind === 'merge') {
        const payload = proposal.payload as MergeProposalPayload;
        proposedMergePairs.add(pairKey(payload.keepKey, payload.removeKey));
      }
    }
    const reviewStats = readReviewStats(db, userId);
    const thresholds = new Map<GraphProposalSource, CalibratedThreshold>();
    for (const source of Object.keys(BASE_THRESHOLDS) as GraphProposalSource[]) {
      thresholds.set(source, calibrateThreshold(source, reviewStats.get(source), options.configuredThreshold));
    }
    const created: GraphProposal[] = [];
    const propose = (proposal: Parameters<typeof insertProposal>[2]) => {
      const inserted = insertProposal(db, userId, { ...proposal, runId });
      if (inserted) created.push(inserted);
      return inserted;
    };

    // --- change detection --------------------------------------------------
    const extractStates = readNoteStates(db, userId, 'extract');
    const hashes = new Map(notes.map((note) => [note.id, noteContentHash(note)]));
    for (const note of notes) {
      const hash = hashes.get(note.id)!;
      if (extractStates.get(note.id)?.contentHash !== hash) {
        stats.changedNotes = (stats.changedNotes as number) + 1;
        const resultCount = graph.entities.filter((entity) => entity.sourceNoteIds.includes(note.id)).length;
        writeNoteState(db, userId, { noteId: note.id, stage: 'extract', contentHash: hash, resultCount });
      }
    }

    // --- rule stage: co-occurrence ------------------------------------------
    for (const candidate of findCooccurrenceCandidates({
      entities: graph.entities,
      relations: graph.relations.filter((relation) => !relation.rejected),
      totalNotes: notes.length,
      excludedPairKeys: proposedRelationPairs,
    })) {
      const payload: RelationProposalPayload = {
        fromKey: candidate.a.id,
        toKey: candidate.b.id,
        fromName: candidate.a.name,
        toName: candidate.b.name,
        type: 'related_to',
        provenance: candidate.sharedNoteIds.slice(0, 10).map((noteId) => ({ noteId, method: 'cooccurrence' as const })),
        metadata: { npmi: Math.round(candidate.npmi * 1000) / 1000, sharedNotes: candidate.sharedNoteIds.length },
      };
      const titles = candidate.sharedNoteIds
        .slice(0, 3)
        .map((id) => notes.find((note) => note.id === id)?.title ?? id)
        .map((title) => `"${title}"`)
        .join(', ');
      if (propose({
        dedupeKey: relationDedupeKey('related_to', payload.fromKey, payload.toKey),
        kind: 'relation',
        source: 'cooccurrence',
        confidence: candidate.confidence,
        description: `Link "${candidate.a.name}" ↔ "${candidate.b.name}" — co-occur in ${candidate.sharedNoteIds.length} notes (${titles}), NPMI ${candidate.npmi.toFixed(2)}`,
        payload,
      })) {
        stats.cooccurrenceProposals = (stats.cooccurrenceProposals as number) + 1;
        proposedRelationPairs.add(pairKey(payload.fromKey, payload.toKey));
      }
    }

    // --- model availability ------------------------------------------------
    let llmAvailable = false;
    if (options.llm) {
      try {
        llmAvailable = await options.llm.healthy();
      } catch {
        llmAvailable = false;
      }
    }
    stats.llmAvailable = llmAvailable;

    // --- rule stage: duplicates (+ model confirmation) -----------------------
    let mergeConfirmBudget = options.mergeConfirmBudget ?? 10;
    for (const candidate of findDuplicateCandidates({ entities: graph.entities, excludedPairKeys: proposedMergePairs })) {
      let llmConfirmed: boolean | undefined;
      let confidence = candidate.similarity;
      if (llmAvailable && options.llm && mergeConfirmBudget > 0) {
        mergeConfirmBudget -= 1;
        const verdict = await confirmMerge(options.llm.complete, candidate.keep, candidate.remove, candidate.similarity, candidate.reason);
        if (verdict === true) llmConfirmed = true;
        if (verdict === false) {
          llmConfirmed = false;
          confidence = Math.round(confidence * 0.5 * 1000) / 1000;
        }
      }
      const payload: MergeProposalPayload = {
        keepKey: candidate.keep.id,
        removeKey: candidate.remove.id,
        keepName: candidate.keep.name,
        removeName: candidate.remove.name,
        entityType: candidate.keep.type,
        llmConfirmed,
      };
      if (propose({
        dedupeKey: mergeDedupeKey(candidate.keep.id, candidate.remove.id),
        kind: 'merge',
        source: 'duplicate',
        confidence,
        description: `Merge "${candidate.remove.name}" into "${candidate.keep.name}" (${candidate.keep.type}) — ${candidate.reason}${llmConfirmed === true ? '; model confirmed' : llmConfirmed === false ? '; model disagreed' : ''}`,
        payload,
      })) {
        stats.duplicateProposals = (stats.duplicateProposals as number) + 1;
      }
    }

    // --- model stages on notes (changed first) -------------------------------
    if (llmAvailable && options.llm) {
      const implicitStates = readNoteStates(db, userId, STAGE_IMPLICIT);
      const validateStates = readNoteStates(db, userId, STAGE_VALIDATE);
      const queue = [...notes]
        .filter((note) => {
          const hash = hashes.get(note.id)!;
          return needsStage(implicitStates.get(note.id), hash) || needsStage(validateStates.get(note.id), hash);
        })
        .sort((a, b) => b.dateModified - a.dateModified);
      const budget = options.llmNoteBudget ?? 5;
      for (const note of queue.slice(0, budget)) {
        const hash = hashes.get(note.id)!;
        const relevant = relevantEntitiesForNote(note, graph.entities);
        stats.llmNotesProcessed = (stats.llmNotesProcessed as number) + 1;

        if (needsStage(implicitStates.get(note.id), hash)) {
          const prior = implicitStates.get(note.id);
          try {
            let count = 0;
            if (relevant.length >= 2 && note.content.trim().length >= 40) {
              const raw = parseJsonLoose(await options.llm.complete(buildImplicitRelationPrompt(note, relevant)));
              const { accepted } = parseImplicitRelations(raw, note, relevant);
              for (const item of accepted) {
                const exists = graph.relations.some(
                  (relation) =>
                    relation.type === item.type &&
                    ((relation.fromEntityId === item.from.id && relation.toEntityId === item.to.id) ||
                      (relation.fromEntityId === item.to.id && relation.toEntityId === item.from.id))
                );
                if (exists) continue;
                const payload: RelationProposalPayload = {
                  fromKey: item.from.id,
                  toKey: item.to.id,
                  fromName: item.from.name,
                  toName: item.to.name,
                  type: item.type,
                  evidenceVerified: item.evidenceVerified,
                  provenance: [{ noteId: note.id, excerpt: item.evidenceVerified ? item.evidence : undefined, method: 'llm' }],
                };
                if (propose({
                  dedupeKey: relationDedupeKey(item.type, item.from.id, item.to.id),
                  kind: 'relation',
                  source: 'llm_implicit',
                  confidence: item.confidence,
                  description: `"${item.from.name}" —${item.type}→ "${item.to.name}" (from "${note.title}")${item.evidenceVerified ? '' : ' — evidence not found in note'}`,
                  payload,
                  noteId: note.id,
                })) {
                  count += 1;
                }
              }
            }
            stats.implicitProposals = (stats.implicitProposals as number) + count;
            writeNoteState(db, userId, { noteId: note.id, stage: STAGE_IMPLICIT, contentHash: hash, resultCount: count });
          } catch (error) {
            stats.llmErrors = (stats.llmErrors as number) + 1;
            const attempts = (prior?.contentHash === `error:${hash}` ? prior.attempts : 0) + 1;
            writeNoteState(db, userId, {
              noteId: note.id,
              stage: STAGE_IMPLICIT,
              contentHash: attempts >= MAX_LLM_ATTEMPTS ? hash : `error:${hash}`,
              attempts,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        if (needsStage(validateStates.get(note.id), hash)) {
          const prior = validateStates.get(note.id);
          try {
            let count = 0;
            const own = graph.entities.filter((entity) => entity.sourceNoteIds.includes(note.id));
            if (note.content.trim().length >= 40) {
              const raw = parseJsonLoose(await options.llm.complete(buildValidationPrompt(note, own)));
              const validation = parseValidation(raw, note, own, graph.entities);
              for (const correction of validation.corrections) {
                const payload: TypeCorrectionPayload = {
                  entityKey: correction.entity.id,
                  name: correction.entity.name,
                  oldType: correction.entity.type,
                  oldSubtype: correction.entity.subtype ?? null,
                  newType: correction.newType,
                  newSubtype: correction.newSubtype,
                  reason: correction.reason,
                };
                if (propose({
                  dedupeKey: typeCorrectionDedupeKey(correction.entity.id, correction.newType, correction.newSubtype),
                  kind: 'type_correction',
                  source: 'llm_validation',
                  confidence: 0.7,
                  description: `Retype "${correction.entity.name}": ${correction.entity.type} → ${correction.newType}${correction.newSubtype ? ` (${correction.newSubtype})` : ''}${correction.reason ? ` — ${correction.reason}` : ''}`,
                  payload,
                  noteId: note.id,
                })) {
                  count += 1;
                  stats.typeProposals = (stats.typeProposals as number) + 1;
                }
              }
              for (const missed of validation.missed) {
                const payload: NewEntityPayload = {
                  entityKey: missed.entityKey,
                  name: missed.name,
                  type: missed.type,
                  subtype: missed.subtype,
                  noteId: note.id,
                };
                if (propose({
                  dedupeKey: newEntityDedupeKey(missed.entityKey, note.id),
                  kind: 'new_entity',
                  source: 'llm_missed',
                  confidence: missed.confidence,
                  description: `Add ${missed.type} "${missed.name}" found in "${note.title}"`,
                  payload,
                  noteId: note.id,
                })) {
                  count += 1;
                  stats.missedEntityProposals = (stats.missedEntityProposals as number) + 1;
                }
              }
            }
            writeNoteState(db, userId, { noteId: note.id, stage: STAGE_VALIDATE, contentHash: hash, resultCount: count });
          } catch (error) {
            stats.llmErrors = (stats.llmErrors as number) + 1;
            const attempts = (prior?.contentHash === `error:${hash}` ? prior.attempts : 0) + 1;
            writeNoteState(db, userId, {
              noteId: note.id,
              stage: STAGE_VALIDATE,
              contentHash: attempts >= MAX_LLM_ATTEMPTS ? hash : `error:${hash}`,
              attempts,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
      stats.llmQueueRemaining = Math.max(0, queue.length - budget);
    }

    // --- auto-apply + retrieval regression gate ------------------------------
    const autoApply = created.filter((proposal) => proposalEligible(proposal, thresholds));
    const evalQueries = readEvalQueries(db, userId);
    let evalBefore: RetrievalEvalResult | null = null;
    let evalAfter: RetrievalEvalResult | null = null;
    let gateReverted = 0;
    if (evalQueries.length > 0) {
      evalBefore = runRetrievalEval({ queries: evalQueries, notes, folders, graph });
    }
    for (const proposal of autoApply) {
      applyProposalRows(db, userId, proposal, false);
      updateProposalStatus(db, userId, proposal.id, { status: 'applied', decidedBy: 'auto' });
    }
    stats.autoApplied = autoApply.length;
    let finalGraph = graph;
    if (autoApply.length > 0) {
      finalGraph = materializeForUser({ db, userId, notes, folders, useCache: false });
      if (evalBefore && evalBefore.queryCount > 0) {
        evalAfter = runRetrievalEval({ queries: evalQueries, notes, folders, graph: finalGraph });
        if ((options.regressionCheck ?? retrievalRegressed)(evalBefore, evalAfter)) {
          for (const proposal of autoApply) {
            revertProposalRows(db, userId, proposal.id);
            db.prepare("UPDATE graph_proposals SET status = 'pending', decidedAt = NULL, decidedBy = NULL WHERE userId = ? AND id = ?")
              .run(userId, proposal.id);
          }
          gateReverted = autoApply.length;
          stats.autoApplied = 0;
          finalGraph = materializeForUser({ db, userId, notes, folders, useCache: false });
        }
      }
    }
    bumpOverlayRevision(userId);

    const metrics = computeGraphQualityMetrics(finalGraph, readProposals(db, userId));
    stats.durationMs = Date.now() - startedAt;
    for (const [source, calibrated] of thresholds) {
      if (calibrated.reviewed > 0) stats[`threshold.${source}`] = Number.isFinite(calibrated.threshold) ? calibrated.threshold : 'review-only';
    }
    finishRun(db, userId, runId, { status: 'completed', stats, metrics, evalBefore, evalAfter, gateReverted });
    return {
      id: runId,
      trigger: options.trigger,
      status: 'completed',
      startedAt,
      finishedAt: Date.now(),
      stats,
      evalBefore,
      evalAfter,
      gateReverted,
      metrics,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    finishRun(db, userId, runId, { status: 'failed', stats, metrics: null, error: message });
    return { id: runId, trigger: options.trigger, status: 'failed', startedAt, finishedAt: Date.now(), stats, error: message };
  }
}

// ---------------------------------------------------------------------------
// Production wiring: queue, debounce, scheduler
// ---------------------------------------------------------------------------
function defaultLlmDeps(): LlmDeps | null {
  if (process.env.GRAPH_ENRICH_LLM === '0') return null;
  return {
    // Only use the model when it is already resident; never trigger activation.
    healthy: () => checkLlamaCppHealth(),
    complete: (prompt) => completeLlamaCpp(prompt, { json: true, timeoutMs: 120_000 }),
  };
}

let chain: Promise<unknown> = Promise.resolve();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const queuedUsers = new Map<string, string>();

export function graphEnrichmentEnabled(): boolean {
  return process.env.GRAPH_ENRICH_ENABLED !== '0' && !process.env.VITEST;
}

/** Run a pass for a user now (serialized behind any in-flight pass). */
export function runGraphPassForUser(userId: string, trigger: string, overrides: Partial<GraphPassOptions> = {}): Promise<GraphRunSummary> {
  const next = chain.then(() =>
    runGraphPass({
      db: getDb(),
      userId,
      notes: readNotes(userId),
      folders: readFolders(userId),
      trigger,
      llm: defaultLlmDeps(),
      llmNoteBudget: envNumber('GRAPH_ENRICH_LLM_NOTES_PER_PASS', trigger === 'manual' ? 10 : 5),
      configuredThreshold: process.env.GRAPH_AUTO_APPLY_THRESHOLD ? envNumber('GRAPH_AUTO_APPLY_THRESHOLD', 0.85) : undefined,
      ...overrides,
    })
  );
  chain = next.catch(() => undefined);
  return next;
}

/** Debounced background pass after note/folder changes. */
export function enqueueGraphUpdate(userId: string, reason = 'note-change'): void {
  bumpOverlayRevision(userId);
  if (!graphEnrichmentEnabled()) return;
  queuedUsers.set(userId, reason);
  const existing = debounceTimers.get(userId);
  if (existing) clearTimeout(existing);
  const delay = envNumber('GRAPH_ENRICH_DEBOUNCE_MS', 15_000);
  debounceTimers.set(
    userId,
    setTimeout(() => {
      debounceTimers.delete(userId);
      const trigger = queuedUsers.get(userId) ?? reason;
      queuedUsers.delete(userId);
      void runGraphPassForUser(userId, trigger).catch((error) => console.warn('[graph] enrichment pass failed', error));
    }, delay)
  );
}

const SCHEDULER_KEY = Symbol.for('markdown-notes.graph-scheduler');

export function startGraphScheduler(): void {
  if (!graphEnrichmentEnabled()) return;
  const globalState = globalThis as unknown as Record<symbol, unknown>;
  if (globalState[SCHEDULER_KEY]) return;
  const minutes = envNumber('GRAPH_ENRICH_INTERVAL_MINUTES', 60);
  if (minutes <= 0) return;
  const sweep = () => {
    try {
      const db = getDb();
      failStaleRuns(db, 30 * 60 * 1000);
      const users = db.prepare('SELECT id FROM users').all() as Array<{ id: string }>;
      for (const user of users) {
        void runGraphPassForUser(user.id, 'schedule').catch((error) => console.warn('[graph] scheduled pass failed', error));
      }
    } catch (error) {
      console.warn('[graph] scheduler sweep failed', error);
    }
  };
  const startup = setTimeout(sweep, 60_000);
  const interval = setInterval(sweep, minutes * 60 * 1000);
  startup.unref?.();
  interval.unref?.();
  globalState[SCHEDULER_KEY] = { startup, interval };
}
