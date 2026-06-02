export interface SkillRecord {
  id: string;
  name: string;
  domain: string;
  type: 'single' | 'merged' | 'bridge' | 'composed';
  content: string;
  sourceNoteIds: string[];
  parentSkillIds: string[];
  dependencies: { requires: string[]; enhances: string[] };
  confidence: 'high' | 'medium' | 'low';
  versions: Array<{ content: string; timestamp: number }>;
  createdAt: number;
  updatedAt: number;
}

export function generateSkillTemplate(data: {
  name: string;
  domain: string;
  description: string;
  triggerConditions: string;
  instructions: string;
  knowledgeBase: string;
  examples: string;
  evidence: string;
  sourceNotes: string[];
  confidence: string;
}): string {
  return `# ${data.name}

## Description
${data.description}

## Trigger Conditions
${data.triggerConditions}

## Instructions
${data.instructions}

## Knowledge Base
${data.knowledgeBase}

## Examples
${data.examples}

## Evidence
${data.evidence}

## Metadata
- **Domain**: ${data.domain}
- **Confidence**: ${data.confidence}
- **Source Notes**: ${data.sourceNotes.join(', ')}
`;
}

export function parseSkillMarkdown(markdown: string): Partial<SkillRecord> {
  const result: Partial<SkillRecord> = {};

  // Parse name from h1
  const h1Match = markdown.match(/^# (.+)$/m);
  if (h1Match) {
    result.name = h1Match[1].trim();
  }

  // Store full content
  result.content = markdown;

  // Parse domain from metadata
  const domainMatch = markdown.match(/\*\*Domain\*\*:\s*(.+)/);
  if (domainMatch) {
    result.domain = domainMatch[1].trim();
  }

  // Parse confidence from metadata
  const confMatch = markdown.match(/\*\*Confidence\*\*:\s*(.+)/);
  if (confMatch) {
    const conf = confMatch[1].trim().toLowerCase();
    if (conf === 'high' || conf === 'medium' || conf === 'low') {
      result.confidence = conf;
    }
  }

  // Parse source notes from metadata
  const srcMatch = markdown.match(/\*\*Source Notes\*\*:\s*(.+)/);
  if (srcMatch) {
    result.sourceNoteIds = srcMatch[1].trim().split(',').map(s => s.trim()).filter(Boolean);
  }

  return result;
}
