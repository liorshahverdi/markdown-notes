import type { GraphEntity, GraphRelation } from '../../types/graph';
import type { Cluster } from './clusterDetector';
import type { RAGConfig } from '../vector/ragPipeline';
import { queryOllama } from '../vector/ragPipeline';

/** Max chars per note to keep the prompt within model context limits. */
const MAX_NOTE_CHARS = 2000;
/** Overall prompt budget (chars). */
const MAX_PROMPT_CHARS = 12_000;

function truncateNote(content: string, limit: number): string {
  if (content.length <= limit) return content;
  // Strip fenced code blocks first — they're bulky and low-signal for skill synthesis
  const withoutCode = content.replace(/```[\s\S]*?```/g, '[code block omitted]');
  if (withoutCode.length <= limit) return withoutCode;
  return withoutCode.slice(0, limit) + '\n…[truncated]';
}

export function buildSkillPrompt(
  cluster: Cluster,
  notes: Array<{ title: string; content: string }>,
  entities: GraphEntity[],
  relations: GraphRelation[]
): string {
  const entityNames = entities.map(e => e.name).join(', ');

  // Budget note chars: distribute evenly, then truncate
  const perNoteLimit = Math.min(MAX_NOTE_CHARS, Math.floor(MAX_PROMPT_CHARS / Math.max(notes.length, 1)));
  const noteContext = notes
    .map(n => `---\nNote: ${n.title}\n${truncateNote(n.content, perNoteLimit)}`)
    .join('\n');

  const relationContext = relations
    .map(r => {
      const from = entities.find(e => e.id === r.fromEntityId)?.name || r.fromEntityId;
      const to = entities.find(e => e.id === r.toEntityId)?.name || r.toEntityId;
      return `${from} -> ${to} (${r.type})`;
    })
    .join('\n');

  return `You are generating a skill document from a knowledge cluster called "${cluster.name}".

## Key Entities
${entityNames}

## Entity Relationships
${relationContext}

## Source Notes
${noteContext}

## Task
Generate a comprehensive skill document in markdown format with the following sections:
- **Description**: What this skill covers and when it applies
- **Trigger Conditions**: When this skill should be activated
- **Instructions**: Step-by-step guidance for applying this skill
- **Knowledge Base**: Core knowledge distilled from the source notes
- **Examples**: Practical examples demonstrating the skill
- **Evidence**: Include citation references to source notes using the format [Note: "Title"]. Every claim should have a citation back to the source material.

Important: Each major claim or piece of knowledge must include a citation in the format [Note: "Note Title"] referencing the source note it came from.
`;
}

export interface SkillSelectionInput {
  name: string;
  selectedEntityIds: string[];
  selectedRelationIds: string[];
  entities: GraphEntity[];
  relations: GraphRelation[];
  notes: Array<{ id: string; title: string; content: string }>;
}

export function buildSkillPromptFromSelection(input: SkillSelectionInput): string {
  const selectedEntityIds = new Set(input.selectedEntityIds);
  const selectedRelationIds = new Set(input.selectedRelationIds);
  const entities = input.entities.filter((entity) => selectedEntityIds.has(entity.id));
  const relations = input.relations.filter(
    (relation) =>
      selectedRelationIds.has(relation.id) ||
      (selectedEntityIds.has(relation.fromEntityId) && selectedEntityIds.has(relation.toEntityId))
  );
  const entityById = new Map(input.entities.map((entity) => [entity.id, entity]));
  const noteById = new Map(input.notes.map((note) => [note.id, note]));
  const citedNoteIds = new Set<string>();

  const relationLines = relations.map((relation) => {
    const from = entityById.get(relation.fromEntityId)?.name ?? relation.fromEntityId;
    const to = entityById.get(relation.toEntityId)?.name ?? relation.toEntityId;
    for (const item of relation.provenance ?? []) citedNoteIds.add(item.noteId);
    const evidence = (relation.provenance ?? [])
      .map((item) => {
        const title = noteById.get(item.noteId)?.title ?? item.noteId;
        return `    - ${item.excerpt ?? 'No excerpt'} [Note: "${title}"] (${item.method})`;
      })
      .join('\n');
    return `- ${from} --${relation.type}--> ${to} (confidence: ${relation.confidence ?? relation.weight ?? 'unknown'})${
      evidence ? `\n${evidence}` : ''
    }`;
  });

  for (const entity of entities) {
    for (const noteId of entity.sourceNoteIds) citedNoteIds.add(noteId);
  }

  const noteContext = Array.from(citedNoteIds)
    .map((noteId) => noteById.get(noteId))
    .filter((note): note is { id: string; title: string; content: string } => Boolean(note))
    .map((note) => `---\nNote: ${note.title}\n${truncateNote(note.content, MAX_NOTE_CHARS)}\nCitation: [Note: "${note.title}"]`)
    .join('\n');

  return `Generate a SKILL.md artifact named "${input.name}" from the selected graph evidence.

Required SKILL.md sections:
## Purpose
## Trigger Conditions
## Instructions
## Knowledge Base
## Examples
## Evidence
## Limits

Selected entities:
${entities.map((entity) => `- ${entity.name} (${entity.type}${entity.subtype ? `/${entity.subtype}` : ''})`).join('\n')}

Selected graph connections:
${relationLines.join('\n')}

Source note evidence:
${noteContext}

Rules:
- Do not include claims without evidence from the selected notes or graph edges.
- Cite every material instruction or fact with [Note: "Title"] and, where relevant, the graph edge id.
- Preserve uncertainty: low-confidence or inferred edges must be described as suggestions, not facts.
- Output only markdown suitable for a SKILL.md file.`;
}

/** Skill generation sends large prompts; allow more time for model loading + first token. */
const SKILL_FETCH_TIMEOUT_MS = 180_000;
/** Large prompts can take a long time for prompt eval before first token arrives. */
const SKILL_READ_TIMEOUT_MS = 180_000;

/**
 * Stream skill generation token-by-token.
 * Caller can update the UI on each yielded string (accumulated result so far).
 */
async function* streamSkillPrompt(prompt: string, config: RAGConfig): AsyncGenerator<string> {
  let result = '';

  for await (const token of queryOllama(prompt, config, undefined, SKILL_FETCH_TIMEOUT_MS, SKILL_READ_TIMEOUT_MS)) {
    result += token;
    yield result;
  }
}

export async function* generateSkillStream(
  cluster: Cluster,
  notes: Array<{ title: string; content: string }>,
  entities: GraphEntity[],
  relations: GraphRelation[],
  config: RAGConfig
): AsyncGenerator<string> {
  yield* streamSkillPrompt(buildSkillPrompt(cluster, notes, entities, relations), config);
}

export async function* generateSkillFromSelectionStream(
  input: SkillSelectionInput,
  config: RAGConfig
): AsyncGenerator<string> {
  yield* streamSkillPrompt(buildSkillPromptFromSelection(input), config);
}

/** Non-streaming convenience wrapper. */
export async function generateSkill(
  cluster: Cluster,
  notes: Array<{ title: string; content: string }>,
  entities: GraphEntity[],
  relations: GraphRelation[],
  config: RAGConfig
): Promise<string> {
  let result = '';
  for await (const snapshot of generateSkillStream(cluster, notes, entities, relations, config)) {
    result = snapshot;
  }
  return result;
}
