/**
 * Shared types for the server-owned graph enrichment loop.
 * Safe to import from both browser and server code.
 */
import type { EntityType, GraphEdgeProvenance, GraphRelation } from '../../types/graph';

export type GraphProposalKind = 'relation' | 'merge' | 'type_correction' | 'new_entity';

export type GraphProposalSource =
  | 'cooccurrence'
  | 'duplicate'
  | 'llm_implicit'
  | 'llm_validation'
  | 'llm_missed'
  | 'transitive'
  | 'user';

/**
 * pending  — waiting for review
 * applied  — in the graph (auto-applied or user-approved)
 * rejected — refused; never proposed again
 * undone   — applied, then reverted; never proposed again
 */
export type GraphProposalStatus = 'pending' | 'applied' | 'rejected' | 'undone';

export interface RelationProposalPayload {
  fromKey: string;
  toKey: string;
  fromName: string;
  toName: string;
  type: GraphRelation['type'];
  provenance: GraphEdgeProvenance[];
  /** False when the model's evidence quote could not be found in the note. */
  evidenceVerified?: boolean;
  metadata?: Record<string, unknown>;
}

export interface MergeProposalPayload {
  keepKey: string;
  removeKey: string;
  keepName: string;
  removeName: string;
  entityType: EntityType;
  llmConfirmed?: boolean;
}

export interface TypeCorrectionPayload {
  entityKey: string;
  name: string;
  oldType: EntityType;
  oldSubtype?: string | null;
  newType: EntityType;
  newSubtype?: string | null;
  reason?: string;
}

export interface NewEntityPayload {
  entityKey: string;
  name: string;
  type: EntityType;
  subtype?: string | null;
  noteId: string;
  excerpt?: string;
}

export type GraphProposalPayload =
  | RelationProposalPayload
  | MergeProposalPayload
  | TypeCorrectionPayload
  | NewEntityPayload;

export interface GraphProposal {
  id: string;
  dedupeKey: string;
  kind: GraphProposalKind;
  source: GraphProposalSource;
  status: GraphProposalStatus;
  confidence: number;
  description: string;
  payload: GraphProposalPayload;
  noteId?: string | null;
  runId?: string | null;
  createdAt: number;
  decidedAt?: number | null;
  decidedBy?: 'auto' | 'user' | null;
  /** Explicit human verdict; drives threshold calibration. */
  reviewOutcome?: 'accepted' | 'rejected' | null;
}

/** Review state attached to materialized relations in `metadata.reviewState`. */
export type RelationReviewState = 'base' | 'auto' | 'accepted' | 'pending' | 'ephemeral';

export interface GraphQualityMetrics {
  precision: number | null;
  precisionBySource: Record<string, { accepted: number; rejected: number; precision: number | null }>;
  provenanceCoverage: number;
  wrongMergeRate: number | null;
  duplicateRate: number;
  entityCount: number;
  relationCount: number;
  pendingProposals: number;
  autoAppliedUnreviewed: number;
}

export interface RetrievalEvalResult {
  queryCount: number;
  recallAtK: number | null;
  mrr: number | null;
}

export interface GraphRunSummary {
  id: string;
  trigger: string;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  startedAt: number;
  finishedAt?: number | null;
  stats: Record<string, number | string | boolean>;
  evalBefore?: RetrievalEvalResult | null;
  evalAfter?: RetrievalEvalResult | null;
  gateReverted?: number;
  metrics?: GraphQualityMetrics | null;
  error?: string | null;
}

/** Header pill status (GET /api/graph/status). */
export interface GraphLoopStatus {
  pendingReview: number;
  /** Notes whose model stages have not run on their current content. */
  queuedNotes: number;
  running: boolean;
  lastRun: Pick<GraphRunSummary, 'id' | 'trigger' | 'status' | 'startedAt' | 'finishedAt'> | null;
  /** The last pass had model work to do but the model was not loaded. */
  modelSkipped: boolean;
}
