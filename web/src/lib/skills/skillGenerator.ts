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

/** Skill generation sends large prompts; allow more time for model loading + first token. */
const SKILL_FETCH_TIMEOUT_MS = 180_000;
/** Large prompts can take a long time for prompt eval before first token arrives. */
const SKILL_READ_TIMEOUT_MS = 180_000;

/**
 * Stream skill generation token-by-token.
 * Caller can update the UI on each yielded string (accumulated result so far).
 */
export async function* generateSkillStream(
  cluster: Cluster,
  notes: Array<{ title: string; content: string }>,
  entities: GraphEntity[],
  relations: GraphRelation[],
  config: RAGConfig
): AsyncGenerator<string> {
  const prompt = buildSkillPrompt(cluster, notes, entities, relations);
  let result = '';

  for await (const token of queryOllama(prompt, config, undefined, SKILL_FETCH_TIMEOUT_MS, SKILL_READ_TIMEOUT_MS)) {
    result += token;
    yield result;
  }
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
