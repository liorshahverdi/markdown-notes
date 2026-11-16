/**
 * Graph quality metrics and a retrieval regression check used to gate each
 * enrichment pass.
 */
import { buildNoteMemoryContext } from '../../memory/noteMemoryPipeline';
import type { GraphProposal, GraphQualityMetrics, RetrievalEvalResult } from '../../graph/proposals';
import type { GraphEntity, GraphRelation } from '../../../types/graph';
import type { FolderRecord, NoteRecord } from '../../../types/note';
import { normalizeEntityName } from './candidates';
import type { EvalQuery } from './graphStore';

export function computeGraphQualityMetrics(
  graph: { entities: GraphEntity[]; relations: GraphRelation[] },
  proposals: GraphProposal[]
): GraphQualityMetrics {
  const precisionBySource: GraphQualityMetrics['precisionBySource'] = {};
  let accepted = 0;
  let rejected = 0;
  for (const proposal of proposals) {
    if (!proposal.reviewOutcome) continue;
    const bucket = (precisionBySource[proposal.source] ??= { accepted: 0, rejected: 0, precision: null });
    if (proposal.reviewOutcome === 'accepted') {
      bucket.accepted += 1;
      accepted += 1;
    } else {
      bucket.rejected += 1;
      rejected += 1;
    }
  }
  for (const bucket of Object.values(precisionBySource)) {
    const total = bucket.accepted + bucket.rejected;
    bucket.precision = total ? bucket.accepted / total : null;
  }

  const visible = graph.relations.filter((relation) => !relation.rejected && relation.metadata?.reviewState !== 'pending');
  const withProvenance = visible.filter((relation) => (relation.provenance?.length ?? 0) > 0).length;

  // Applied merges vs. applied merges that were later reverted.
  const everApplied = proposals.filter((proposal) => proposal.kind === 'merge' && (proposal.status === 'applied' || proposal.status === 'undone'));
  const wrongMerges = everApplied.filter((proposal) => proposal.status === 'undone').length;

  const seen = new Map<string, number>();
  const candidates = graph.entities.filter((entity) => entity.type !== 'note' && entity.type !== 'folder');
  for (const entity of candidates) {
    const key = `${entity.type}|${normalizeEntityName(entity.name)}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const duplicates = Array.from(seen.values()).reduce((sum, count) => sum + (count > 1 ? count - 1 : 0), 0);

  return {
    precision: accepted + rejected ? accepted / (accepted + rejected) : null,
    precisionBySource,
    provenanceCoverage: visible.length ? withProvenance / visible.length : 1,
    wrongMergeRate: everApplied.length ? wrongMerges / everApplied.length : null,
    duplicateRate: candidates.length ? duplicates / candidates.length : 0,
    entityCount: graph.entities.length,
    relationCount: visible.length,
    pendingProposals: proposals.filter((proposal) => proposal.status === 'pending').length,
    autoAppliedUnreviewed: proposals.filter((proposal) => proposal.status === 'applied' && proposal.decidedBy === 'auto' && !proposal.reviewOutcome).length,
  };
}

/**
 * recall@k and MRR of expected notes over the saved question set, using the
 * same note+graph retrieval the chat uses.
 */
export function runRetrievalEval(input: {
  queries: EvalQuery[];
  notes: NoteRecord[];
  folders: FolderRecord[];
  graph: { entities: GraphEntity[]; relations: GraphRelation[] };
  topK?: number;
}): RetrievalEvalResult {
  const noteIds = new Set(input.notes.map((note) => note.id));
  const queries = input.queries.filter((query) => noteIds.has(query.expectedNoteId));
  if (queries.length === 0) return { queryCount: 0, recallAtK: null, mrr: null };
  let hits = 0;
  let reciprocal = 0;
  for (const query of queries) {
    const context = buildNoteMemoryContext({
      notes: input.notes,
      folders: input.folders,
      query: query.query,
      topK: input.topK ?? 5,
      graph: input.graph,
    });
    const ranked = context.citations.filter((citation) => citation.kind === 'note').map((citation) => citation.noteId);
    const index = ranked.indexOf(query.expectedNoteId);
    if (index >= 0) {
      hits += 1;
      reciprocal += 1 / (index + 1);
    }
  }
  return {
    queryCount: queries.length,
    recallAtK: hits / queries.length,
    mrr: reciprocal / queries.length,
  };
}

/** A pass "regresses" retrieval if recall or MRR drops by more than a hair. */
export function retrievalRegressed(before: RetrievalEvalResult, after: RetrievalEvalResult, tolerance = 0.001): boolean {
  if (!before.queryCount || before.recallAtK == null || after.recallAtK == null) return false;
  if (after.recallAtK < before.recallAtK - tolerance) return true;
  return (after.mrr ?? 0) < (before.mrr ?? 0) - tolerance;
}
