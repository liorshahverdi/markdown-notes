/**
 * Implicit relationship extraction using LLM prompts.
 */

export function buildImplicitExtractionPrompt(
  noteTitle: string,
  noteContent: string,
  knownEntityNames?: string[]
): string {
  const entityConstraint = knownEntityNames?.length
    ? `\n\nIMPORTANT: Only use entity names from this list:\n${knownEntityNames.map((n) => `- ${n}`).join('\n')}\n\nBoth "fromEntity" and "toEntity" MUST be exact names from the list above. Do NOT invent new entity names.`
    : '';

  return `Analyze the following note and extract implicit relationships between known entities.

Title: ${noteTitle}
Content:
${noteContent}${entityConstraint}

Extract the following types of relationships:
1. **Causal relationships** - where one thing causes or leads to another
2. **Temporal sequences** - where events follow a time order
3. **Hierarchical structures** - where entities are part of or contain other entities
4. **Attendance** - where a person attended an event
5. **Location** - where something is located at a place
6. **Ownership** - where someone owns or created something

Respond with a JSON array of objects:
[
  {
    "fromEntity": "entity name",
    "toEntity": "entity name",
    "type": "causes" | "precedes" | "part_of" | "contains" | "depends_on" | "attended" | "located_at" | "owns" | "created",
    "confidence": 0.0-1.0
  }
]

Only include relationships you are confident about. Return an empty array [] if none found.`;
}

export function parseExtractionResponse(
  response: string
): Array<{ fromEntity: string; toEntity: string; type: string; confidence: number }> {
  if (!response || response.trim().length === 0) {
    return [];
  }

  // Strip markdown code block if present
  let cleaned = response.trim();
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item: Record<string, unknown>) =>
        typeof item.fromEntity === 'string' &&
        typeof item.toEntity === 'string' &&
        typeof item.type === 'string' &&
        typeof item.confidence === 'number'
    );
  } catch {
    return [];
  }
}

/**
 * Build a prompt for entity type validation/correction.
 * Asks the LLM to verify entity types and suggest missed entities.
 */
export function buildEntityValidationPrompt(
  entities: Array<{ name: string; type: string; subtype?: string }>,
  noteContent: string
): string {
  const entityList = entities
    .map((e) => `- "${e.name}" (type: ${e.type}${e.subtype ? `, subtype: ${e.subtype}` : ''})`)
    .join('\n');

  return `Review the following entities extracted from a note and check if their types are correct.

Entity types available: Person, Object, Location, Event, Other (with subtypes: topic, tag, organization, tool, meeting)

Extracted entities:
${entityList}

Note content:
${noteContent.slice(0, 3000)}

Respond with a JSON object:
{
  "corrections": [
    {
      "name": "entity name",
      "currentType": "current type",
      "suggestedType": "correct type",
      "suggestedSubtype": "optional subtype or null",
      "reason": "why this correction is needed"
    }
  ],
  "missed": [
    {
      "name": "missed entity name",
      "type": "suggested type",
      "subtype": "optional subtype or null",
      "confidence": 0.0-1.0
    }
  ]
}

Only include corrections where you are confident the current type is wrong. Return empty arrays if everything looks correct.`;
}

export interface ValidationResponse {
  corrections: Array<{
    name: string;
    currentType: string;
    suggestedType: string;
    suggestedSubtype: string | null;
    reason: string;
  }>;
  missed: Array<{
    name: string;
    type: string;
    subtype: string | null;
    confidence: number;
  }>;
}

export function parseValidationResponse(data: unknown): ValidationResponse {
  const result: ValidationResponse = { corrections: [], missed: [] };
  if (!data || typeof data !== 'object') return result;

  const obj = data as Record<string, unknown>;

  if (Array.isArray(obj.corrections)) {
    result.corrections = obj.corrections.filter(
      (c: any) =>
        typeof c.name === 'string' &&
        typeof c.currentType === 'string' &&
        typeof c.suggestedType === 'string' &&
        typeof c.reason === 'string'
    );
  }

  if (Array.isArray(obj.missed)) {
    result.missed = obj.missed.filter(
      (m: any) =>
        typeof m.name === 'string' &&
        typeof m.type === 'string' &&
        typeof m.confidence === 'number'
    );
  }

  return result;
}
