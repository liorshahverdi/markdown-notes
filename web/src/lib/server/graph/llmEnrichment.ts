/**
 * Model-assisted enrichment: implicit relations, type validation, missed
 * entities and merge confirmation. All model output is constrained to known
 * entities and verified against the note text before it becomes a proposal.
 */
import { entityKeyFor } from '../graphSnapshot';
import type { EntityType, GraphEntity, GraphRelation } from '../../../types/graph';
import type { NoteRecord } from '../../../types/note';
import { normalizeEntityName } from './candidates';

export type CompleteJson = (prompt: string) => Promise<string>;

export const IMPLICIT_RELATION_TYPES = [
  'causes',
  'precedes',
  'part_of',
  'contains',
  'depends_on',
  'implements',
  'contrasts_with',
  'attended',
  'located_at',
  'owns',
  'created',
] as const satisfies ReadonlyArray<GraphRelation['type']>;

const ENTITY_TYPES: EntityType[] = ['Person', 'Object', 'Location', 'Event', 'Other'];
const MAX_PROMPT_ENTITIES = 60;
const MAX_NOTE_CHARS = 6000;

export function parseJsonLoose(text: string): unknown {
  if (!text) return null;
  let cleaned = text.trim();
  const fence = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fence) cleaned = fence[1].trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function noteMentions(noteText: string, name: string): boolean {
  const needle = name.trim();
  if (needle.length < 2) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(needle)}($|[^\\p{L}\\p{N}])`, 'iu').test(noteText);
}

/**
 * Only the entities relevant to this note: those extracted from it plus known
 * entities whose names appear verbatim in its text.
 */
export function relevantEntitiesForNote(note: NoteRecord, entities: GraphEntity[]): GraphEntity[] {
  const text = `${note.title}\n${note.content}`;
  const own = entities.filter((entity) => entity.sourceNoteIds.includes(note.id) && entity.type !== 'folder');
  const mentioned = entities.filter(
    (entity) =>
      !entity.sourceNoteIds.includes(note.id) &&
      entity.type !== 'folder' &&
      entity.name.length > 2 &&
      noteMentions(text, entity.name)
  );
  const seen = new Set<string>();
  const out: GraphEntity[] = [];
  for (const entity of [...own, ...mentioned]) {
    if (seen.has(entity.id)) continue;
    seen.add(entity.id);
    out.push(entity);
    if (out.length >= MAX_PROMPT_ENTITIES) break;
  }
  return out;
}

/** Exact (case/whitespace-insensitive) or normalized-name resolution — never substring. */
export function buildNameResolver(entities: GraphEntity[]): (name: string) => GraphEntity | null {
  const exact = new Map<string, GraphEntity>();
  const normalized = new Map<string, GraphEntity | null>();
  for (const entity of entities) {
    exact.set(normalizeText(entity.name), entity);
    const norm = normalizeEntityName(entity.name);
    // Ambiguous normalized names resolve to nothing rather than guessing.
    normalized.set(norm, normalized.has(norm) && normalized.get(norm)?.id !== entity.id ? null : entity);
  }
  return (name: string) => exact.get(normalizeText(name)) ?? normalized.get(normalizeEntityName(name)) ?? null;
}

// ---------------------------------------------------------------------------
// Implicit relations
// ---------------------------------------------------------------------------
export function buildImplicitRelationPrompt(note: NoteRecord, entities: GraphEntity[]): string {
  const list = entities.map((entity) => `- ${entity.name} (${entity.type === 'note' ? 'this note' : entity.type})`).join('\n');
  return `You extract implicit relationships between KNOWN entities from a single note.

Note title: ${note.title}
Note content:
"""
${note.content.slice(0, MAX_NOTE_CHARS)}
"""

Known entities (use these names exactly; do not invent new ones):
${list}

Allowed relation types: ${IMPLICIT_RELATION_TYPES.join(', ')}.

Respond with a JSON object:
{"relations": [{"from": "<known entity>", "to": "<known entity>", "type": "<allowed type>", "confidence": 0.0-1.0, "evidence": "<short exact quote from the note that states this>"}]}

Only include relationships the note states or clearly implies. The evidence MUST be copied verbatim from the note. Return {"relations": []} if none.`;
}

export interface ImplicitRelationResult {
  from: GraphEntity;
  to: GraphEntity;
  type: GraphRelation['type'];
  confidence: number;
  evidence: string;
  evidenceVerified: boolean;
}

export function parseImplicitRelations(
  raw: unknown,
  note: NoteRecord,
  allowed: GraphEntity[]
): { accepted: ImplicitRelationResult[]; rejected: Array<{ item: unknown; reason: string }> } {
  const resolve = buildNameResolver(allowed);
  const items = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { relations?: unknown }).relations)
      ? (raw as { relations: unknown[] }).relations
      : [];
  const noteText = normalizeText(`${note.title}\n${note.content}`);
  const accepted: ImplicitRelationResult[] = [];
  const rejected: Array<{ item: unknown; reason: string }> = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') {
      rejected.push({ item, reason: 'not an object' });
      continue;
    }
    const record = item as Record<string, unknown>;
    const fromName = record.from ?? record.fromEntity;
    const toName = record.to ?? record.toEntity;
    if (typeof fromName !== 'string' || typeof toName !== 'string' || typeof record.type !== 'string') {
      rejected.push({ item, reason: 'missing fields' });
      continue;
    }
    const type = record.type as GraphRelation['type'];
    if (!(IMPLICIT_RELATION_TYPES as readonly string[]).includes(type)) {
      rejected.push({ item, reason: `unsupported type ${type}` });
      continue;
    }
    const from = resolve(fromName);
    const to = resolve(toName);
    if (!from || !to) {
      rejected.push({ item, reason: 'unknown entity name' });
      continue;
    }
    if (from.id === to.id) {
      rejected.push({ item, reason: 'self relation' });
      continue;
    }
    let confidence = typeof record.confidence === 'number' ? Math.max(0, Math.min(1, record.confidence)) : 0.5;
    const evidence = typeof record.evidence === 'string' ? record.evidence.trim() : '';
    const evidenceVerified = evidence.length >= 8 && noteText.includes(normalizeText(evidence));
    if (!evidenceVerified) confidence = Math.min(confidence, 0.5);
    accepted.push({ from, to, type, confidence, evidence, evidenceVerified });
  }
  return { accepted, rejected };
}

// ---------------------------------------------------------------------------
// Type validation + missed entities
// ---------------------------------------------------------------------------
export function buildValidationPrompt(note: NoteRecord, entities: GraphEntity[]): string {
  const list = entities
    .filter((entity) => entity.type !== 'note' && entity.type !== 'folder')
    .map((entity) => `- "${entity.name}" (type: ${entity.type}${entity.subtype ? `, subtype: ${entity.subtype}` : ''})`)
    .join('\n');
  return `Review entities extracted from a note.
Entity types: Person, Object, Location, Event, Other (Other subtypes: topic, tag, organization, tool, meeting).

Extracted entities:
${list || '(none)'}

Note title: ${note.title}
Note content:
"""
${note.content.slice(0, MAX_NOTE_CHARS)}
"""

Respond with a JSON object:
{"corrections": [{"name": "...", "suggestedType": "...", "suggestedSubtype": null, "reason": "..."}],
 "missed": [{"name": "<exact text from the note>", "type": "...", "subtype": null, "confidence": 0.0-1.0}]}

Only list corrections where the current type is clearly wrong, and missed entities that are important named people, places, organizations, tools or events. Return empty arrays if everything looks correct.`;
}

export interface ValidationResult {
  corrections: Array<{ entity: GraphEntity; newType: EntityType; newSubtype: string | null; reason: string }>;
  missed: Array<{ name: string; type: EntityType; subtype: string | null; confidence: number; entityKey: string }>;
}

export function parseValidation(raw: unknown, note: NoteRecord, noteEntities: GraphEntity[], allEntities: GraphEntity[]): ValidationResult {
  const result: ValidationResult = { corrections: [], missed: [] };
  if (!raw || typeof raw !== 'object') return result;
  const obj = raw as Record<string, unknown>;
  const resolveOwn = buildNameResolver(noteEntities.filter((entity) => entity.type !== 'note' && entity.type !== 'folder'));
  const resolveAny = buildNameResolver(allEntities);
  const text = `${note.title}\n${note.content}`;

  for (const item of Array.isArray(obj.corrections) ? obj.corrections : []) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (typeof record.name !== 'string' || typeof record.suggestedType !== 'string') continue;
    const newType = record.suggestedType as EntityType;
    if (!ENTITY_TYPES.includes(newType)) continue;
    const entity = resolveOwn(record.name);
    if (!entity) continue;
    const newSubtype = typeof record.suggestedSubtype === 'string' && record.suggestedSubtype ? record.suggestedSubtype : null;
    if (entity.type === newType && (entity.subtype ?? null) === newSubtype) continue;
    result.corrections.push({ entity, newType, newSubtype, reason: typeof record.reason === 'string' ? record.reason : '' });
  }

  for (const item of Array.isArray(obj.missed) ? obj.missed : []) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (typeof record.name !== 'string' || typeof record.type !== 'string') continue;
    const type = record.type as EntityType;
    if (!ENTITY_TYPES.includes(type)) continue;
    const name = record.name.trim();
    if (name.length < 2 || name.length > 80) continue;
    if (!noteMentions(text, name)) continue; // must appear verbatim
    if (resolveAny(name)) continue; // already known
    const subtype = typeof record.subtype === 'string' && record.subtype ? record.subtype : null;
    const confidence = typeof record.confidence === 'number' ? Math.max(0, Math.min(1, record.confidence)) : 0.5;
    result.missed.push({ name, type, subtype, confidence, entityKey: entityKeyFor({ type, subtype, name }) });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Merge confirmation
// ---------------------------------------------------------------------------
export function buildMergeConfirmationPrompt(keep: GraphEntity, remove: GraphEntity, similarity: number, reason: string): string {
  return `Two entities in a personal knowledge graph may be duplicates.

Entity A: "${keep.name}" (type: ${keep.type})
Entity B: "${remove.name}" (type: ${remove.type})

Detected similarity: ${reason} (score: ${similarity.toFixed(2)})

Should these entities be merged? Only answer true if both names refer to the same real-world thing.
Respond with JSON: {"shouldMerge": true or false, "reason": "short explanation"}`;
}

export async function confirmMerge(
  complete: CompleteJson,
  keep: GraphEntity,
  remove: GraphEntity,
  similarity: number,
  reason: string
): Promise<boolean | null> {
  const prompt = buildMergeConfirmationPrompt(keep, remove, similarity, reason);
  try {
    const parsed = parseJsonLoose(await complete(prompt)) as { shouldMerge?: unknown } | null;
    if (!parsed || typeof parsed.shouldMerge !== 'boolean') return null;
    return parsed.shouldMerge;
  } catch {
    return null;
  }
}
