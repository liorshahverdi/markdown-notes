/**
 * Pure candidate generators for the enrichment loop.
 */
import type { GraphEntity, GraphRelation } from '../../../types/graph';
import type { GraphProposalSource } from '../../graph/proposals';

// ---------------------------------------------------------------------------
// Dedupe keys — stable across runs so rejections are remembered forever.
// ---------------------------------------------------------------------------
const SYMMETRIC_TYPES = new Set(['related_to', 'contrasts_with', 'transitive']);

export function relationDedupeKey(type: string, fromKey: string, toKey: string): string {
  if (SYMMETRIC_TYPES.has(type)) {
    const [a, b] = [fromKey, toKey].sort();
    return `rel:${type}:${a}<->${b}`;
  }
  return `rel:${type}:${fromKey}->${toKey}`;
}

export function mergeDedupeKey(keyA: string, keyB: string): string {
  const [a, b] = [keyA, keyB].sort();
  return `merge:${a}<->${b}`;
}

export function typeCorrectionDedupeKey(entityKey: string, newType: string, newSubtype?: string | null): string {
  return `type:${entityKey}->${newType}${newSubtype ? `/${newSubtype}` : ''}`;
}

export function newEntityDedupeKey(entityKey: string, noteId: string): string {
  return `entity:${entityKey}@${noteId}`;
}

export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('::');
}

// ---------------------------------------------------------------------------
// Co-occurrence (normalized PMI) candidates
// ---------------------------------------------------------------------------
const DATE_LIKE = /^(\d{1,4}[-/.]\d{1,2}([-/.]\d{1,4})?|\d{4}|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}(, \d{4})?)$/i;

export function isCooccurrenceEligible(entity: GraphEntity): boolean {
  if (entity.type === 'note' || entity.type === 'folder') return false;
  if (entity.type === 'Event' && DATE_LIKE.test(entity.name.trim())) return false;
  return entity.name.trim().length > 2;
}

export interface CooccurrenceCandidate {
  a: GraphEntity;
  b: GraphEntity;
  sharedNoteIds: string[];
  npmi: number;
  confidence: number;
}

/**
 * Entities that co-occur more than chance predicts. Normalized PMI keeps
 * ubiquitous tags/folders from linking to everything. Already-related or
 * already-proposed pairs are filtered *before* the limit is applied.
 */
export function findCooccurrenceCandidates(input: {
  entities: GraphEntity[];
  relations: GraphRelation[];
  totalNotes: number;
  excludedPairKeys?: Set<string>;
  minShared?: number;
  minNpmi?: number;
  limit?: number;
}): CooccurrenceCandidate[] {
  const minShared = input.minShared ?? 2;
  const minNpmi = input.minNpmi ?? 0.25;
  const limit = input.limit ?? 50;
  const total = Math.max(input.totalNotes, 1);
  if (total < 3) return [];

  const related = new Set<string>();
  for (const relation of input.relations) related.add(pairKey(relation.fromEntityId, relation.toEntityId));

  const eligible = input.entities.filter((entity) => isCooccurrenceEligible(entity) && entity.sourceNoteIds.length >= minShared);
  // Inverted index note -> entities for sparse pair counting.
  const byNote = new Map<string, GraphEntity[]>();
  for (const entity of eligible) {
    for (const noteId of new Set(entity.sourceNoteIds)) {
      const list = byNote.get(noteId) ?? [];
      list.push(entity);
      byNote.set(noteId, list);
    }
  }
  const shared = new Map<string, { a: GraphEntity; b: GraphEntity; notes: string[] }>();
  for (const [noteId, list] of byNote) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const [a, b] = list[i].id < list[j].id ? [list[i], list[j]] : [list[j], list[i]];
        const key = pairKey(a.id, b.id);
        const entry = shared.get(key) ?? { a, b, notes: [] };
        entry.notes.push(noteId);
        shared.set(key, entry);
      }
    }
  }

  const candidates: CooccurrenceCandidate[] = [];
  for (const [key, { a, b, notes }] of shared) {
    if (notes.length < minShared) continue;
    if (related.has(key) || input.excludedPairKeys?.has(key)) continue;
    if (a.name.trim().toLowerCase() === b.name.trim().toLowerCase()) continue;
    const pA = new Set(a.sourceNoteIds).size / total;
    const pB = new Set(b.sourceNoteIds).size / total;
    const pAB = notes.length / total;
    if (pAB >= 1) continue; // co-occur everywhere: carries no information
    const pmi = Math.log2(pAB / (pA * pB));
    const npmi = pmi / -Math.log2(pAB);
    if (!Number.isFinite(npmi) || npmi < minNpmi) continue;
    const support = Math.min(notes.length / 5, 1);
    const confidence = Math.round((0.6 * npmi + 0.4 * support) * 1000) / 1000;
    candidates.push({ a, b, sharedNoteIds: notes, npmi, confidence });
  }
  return candidates.sort((x, y) => y.confidence - x.confidence || y.sharedNoteIds.length - x.sharedNoteIds.length).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------
export function normalizeEntityName(name: string): string {
  let value = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\.js\b/g, 'js')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  value = value
    .split(' ')
    .map((word) => (word.length > 4 && word.endsWith('ies') ? `${word.slice(0, -3)}y` : word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word))
    .join(' ');
  return value;
}

function digitsOf(value: string): string {
  return (value.match(/\d+/g) ?? []).join(',');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = curr;
  }
  return prev[b.length];
}

export interface DuplicateCandidate {
  keep: GraphEntity;
  remove: GraphEntity;
  similarity: number;
  reason: string;
}

const NEVER_MERGE_TYPES = new Set(['note', 'folder']);

/**
 * Same-type duplicates only. Notes and folders are never merged. Exact
 * normalized matches score 0.95; near matches use edit-distance ratio.
 */
export function findDuplicateCandidates(input: {
  entities: GraphEntity[];
  excludedPairKeys?: Set<string>;
  minSimilarity?: number;
  limit?: number;
}): DuplicateCandidate[] {
  const minSimilarity = input.minSimilarity ?? 0.85;
  const byType = new Map<string, Array<{ entity: GraphEntity; norm: string }>>();
  for (const entity of input.entities) {
    if (NEVER_MERGE_TYPES.has(entity.type)) continue;
    const norm = normalizeEntityName(entity.name);
    if (norm.length < 2) continue;
    const list = byType.get(entity.type) ?? [];
    list.push({ entity, norm });
    byType.set(entity.type, list);
  }
  const out: DuplicateCandidate[] = [];
  for (const list of byType.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const x = list[i];
        const y = list[j];
        if (input.excludedPairKeys?.has(pairKey(x.entity.id, y.entity.id))) continue;
        let similarity = 0;
        let reason = '';
        if (x.norm === y.norm) {
          similarity = 0.95;
          reason = 'same name after normalization';
        } else {
          // Names that differ in their numbers (dates, versions, "Untitled 2/3") are different things.
          if (digitsOf(x.norm) !== digitsOf(y.norm)) continue;
          const longest = Math.max(x.norm.length, y.norm.length);
          if (longest < 5 || Math.abs(x.norm.length - y.norm.length) > 3) continue;
          const ratio = 1 - levenshtein(x.norm, y.norm) / longest;
          if (ratio < minSimilarity) continue;
          similarity = Math.round(ratio * 0.9 * 1000) / 1000;
          reason = `edit-distance similarity ${(ratio * 100).toFixed(0)}%`;
        }
        if (similarity < minSimilarity * 0.9) continue;
        // Keep the better-supported entity; tie → shorter (usually canonical) name.
        const xScore = x.entity.sourceNoteIds.length;
        const yScore = y.entity.sourceNoteIds.length;
        const keepX = xScore > yScore || (xScore === yScore && x.entity.name.length <= y.entity.name.length);
        out.push({
          keep: keepX ? x.entity : y.entity,
          remove: keepX ? y.entity : x.entity,
          similarity,
          reason,
        });
      }
    }
  }
  return out.sort((a, b) => b.similarity - a.similarity).slice(0, input.limit ?? 50);
}

// ---------------------------------------------------------------------------
// Threshold calibration from human review history
// ---------------------------------------------------------------------------
export const BASE_THRESHOLDS: Record<GraphProposalSource, number> = {
  cooccurrence: 0.85,
  duplicate: 0.9,
  llm_implicit: 0.85,
  llm_validation: Infinity, // type corrections always go to review
  llm_missed: 0.9, // review-only until the user has vetted enough of them (see TRUST_REQUIRED)
  transitive: Infinity,
  user: 0,
};

/**
 * Sources whose confidence is purely model self-reported: never auto-apply
 * until at least 5 human reviews show they are reliable.
 */
const TRUST_REQUIRED = new Set<GraphProposalSource>(['llm_missed']);

export interface CalibratedThreshold {
  source: GraphProposalSource;
  threshold: number;
  reviewed: number;
  acceptanceRate: number | null;
  reason: string;
}

export function calibrateThreshold(
  source: GraphProposalSource,
  stats: { accepted: number; rejected: number } | undefined,
  configuredBase?: number
): CalibratedThreshold {
  const fixed = BASE_THRESHOLDS[source];
  // A configured threshold can only make auto-apply stricter, never looser.
  const base = Number.isFinite(fixed) && configuredBase != null ? Math.max(fixed, configuredBase) : fixed;
  const accepted = stats?.accepted ?? 0;
  const rejected = stats?.rejected ?? 0;
  const reviewed = accepted + rejected;
  if (!Number.isFinite(base)) {
    return { source, threshold: base, reviewed, acceptanceRate: reviewed ? accepted / reviewed : null, reason: 'always reviewed' };
  }
  if (reviewed < 5) {
    if (TRUST_REQUIRED.has(source)) {
      return { source, threshold: Infinity, reviewed, acceptanceRate: reviewed ? accepted / reviewed : null, reason: 'review-only until 5 reviews' };
    }
    return { source, threshold: base, reviewed, acceptanceRate: reviewed ? accepted / reviewed : null, reason: 'not enough reviews yet' };
  }
  const rate = accepted / reviewed;
  if (rate < 0.5) return { source, threshold: Infinity, reviewed, acceptanceRate: rate, reason: 'low acceptance — auto-apply disabled' };
  if (rate < 0.7) return { source, threshold: Math.min(0.99, base + 0.1), reviewed, acceptanceRate: rate, reason: 'mixed acceptance — stricter' };
  if (rate >= 0.9 && reviewed >= 10) return { source, threshold: Math.max(0.6, base - 0.1), reviewed, acceptanceRate: rate, reason: 'high acceptance — relaxed' };
  return { source, threshold: base, reviewed, acceptanceRate: rate, reason: 'acceptance within normal range' };
}
