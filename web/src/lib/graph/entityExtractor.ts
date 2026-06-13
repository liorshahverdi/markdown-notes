import type { GraphEntity, GraphRelation, EntityType } from '../../types/graph';

export interface ExtractedEntity {
  name: string;
  type: EntityType;
  subtype?: string;
  confidence: number;
}

export interface ExtractedRelation {
  fromName: string;
  toName: string;
  type: GraphRelation['type'];
  method?: 'regex' | 'ner' | 'cooccurrence' | 'llm' | 'user' | 'diagram';
  excerpt?: string;
  confidence?: number;
}

const HEADING_RE = /^#{1,3}\s+(.+)$/gm;
const HASHTAG_RE = /(?:^|\s)#(\w+)/g;
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
const MERMAID_BLOCK_RE = /```mermaid\s*\n([\s\S]*?)```/gi;
const MERMAID_EDGE_RE = /^\s*([A-Za-z0-9_][\w -]*?)(?:\[[^\]]+\])?\s*(?:-->|---|==>|-.->)\s*([A-Za-z0-9_][\w -]*?)(?:\[[^\]]+\])?\s*$/gm;

const MAX_HEADINGS_PER_NOTE = 10;

const STRUCTURAL_HEADINGS = new Set([
  'summary',
  'overview',
  'introduction',
  'intro',
  'conclusion',
  'helpers',
  'usage',
  'examples',
  'example',
  'references',
  'appendix',
  'notes',
  'changelog',
  'faq',
  'prerequisites',
  'requirements',
  'setup',
  'installation',
  'configuration',
  'troubleshooting',
  'resources',
  'links',
  'see also',
  'table of contents',
  'toc',
]);

export function isLowValueHeading(heading: string): boolean {
  const trimmed = heading.trim();
  const lower = trimmed.toLowerCase();

  // Structural / stopword headings
  if (STRUCTURAL_HEADINGS.has(lower)) return true;

  // ALL_CAPS constants like QUERY_BODY, MAX_RETRIES
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(trimmed)) return true;

  // CLI flags like --verbose, -h
  if (/^-{1,2}[a-zA-Z]/.test(trimmed)) return true;

  // Single short words (1-2 chars) are too generic
  if (trimmed.length <= 2) return true;

  // Too long — sentence-style headings or descriptions (>60 chars)
  if (trimmed.length > 60) return true;

  // Looks like a sentence (ends with punctuation or contains commas) — not a topic name
  if (/[.;:!?,]/.test(trimmed)) return true;

  // Contains code-like patterns (backticks, parens with args, brackets)
  if (/[`()\[\]{}]/.test(trimmed)) return true;

  // Numbered list items used as headings (e.g., "1. Falls back to...")
  if (/^\d+\.\s/.test(trimmed)) return true;

  return false;
}

// Date patterns for Event extraction
const DATE_PATTERNS = [
  /\b\d{4}-\d{2}-\d{2}\b/g, // YYYY-MM-DD
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,\s*\d{4})?\b/gi, // Month DD, YYYY
];

const TEMPORAL_MARKERS = /\b(meeting|deadline|milestone|conference|workshop|sprint|release|launch|event|ceremony|presentation|demo|review|standup|retrospective|kickoff)\b/gi;

// Object/tool extraction patterns
const TOOL_PATTERNS = /\b(?:using|built with|powered by|implemented in|written in|based on|running on)\s+([A-Z][a-zA-Z0-9.]+(?:\s+[A-Z][a-zA-Z0-9.]+)?)\b/g;

export function extractEntities(
  noteId: string,
  title: string,
  content: string,
  folderPath?: string[]
): {
  entities: ExtractedEntity[];
  relations: ExtractedRelation[];
} {
  const entityMap = new Map<string, ExtractedEntity>();
  const relations: ExtractedRelation[] = [];

  // 1. The note itself is always an entity
  const noteKey = `note::${title}`;
  entityMap.set(noteKey, { name: title, type: 'note', confidence: 1.0 });

  // 2. Extract headings as topic entities (filtered and capped)
  // Strip fenced code blocks so `#` comments inside code don't match as headings
  const contentWithoutCode = content.replace(/```[\s\S]*?```/g, '');

  let match: RegExpExecArray | null;
  const candidateHeadings: string[] = [];
  while ((match = HEADING_RE.exec(contentWithoutCode)) !== null) {
    const headingText = match[1].trim();
    if (!isLowValueHeading(headingText)) {
      candidateHeadings.push(headingText);
    }
  }
  // Sort by specificity (longer / more words first), then cap
  candidateHeadings.sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length);
  const selectedHeadings = candidateHeadings.slice(0, MAX_HEADINGS_PER_NOTE);

  for (const headingText of selectedHeadings) {
    const key = `Other::${headingText}`;
    if (!entityMap.has(key)) {
      entityMap.set(key, { name: headingText, type: 'Other', subtype: 'topic', confidence: 0.9 });
    }
    relations.push({
      fromName: headingText,
      toName: title,
      type: 'mentions',
    });
  }

  // 3. Extract hashtags as tag entities
  // We need to skip hashtags that are actually heading markers.
  // Split content by lines and only look for hashtags in non-heading lines.
  const lines = content.split('\n');
  for (const line of lines) {
    // Skip heading lines
    if (/^#{1,6}\s+/.test(line)) continue;

    let tagMatch: RegExpExecArray | null;
    const lineTagRe = /(?:^|\s)#(\w+)/g;
    while ((tagMatch = lineTagRe.exec(line)) !== null) {
      const tag = tagMatch[1];
      const key = `Other::tag::${tag}`;
      if (!entityMap.has(key)) {
        entityMap.set(key, { name: tag, type: 'Other', subtype: 'tag', confidence: 0.85 });
      }
      // Only add relation once per unique tag
      const existingRelation = relations.find(
        (r) => r.fromName === tag && r.toName === title && r.type === 'mentions'
      );
      if (!existingRelation) {
        relations.push({ fromName: tag, toName: title, type: 'mentions' });
      }
    }
  }

  // 4. Extract markdown links as links_to relations
  while ((match = LINK_RE.exec(content)) !== null) {
    const linkText = match[1];
    relations.push({ fromName: title, toName: linkText, type: 'links_to' });
  }

  // 5. Extract Mermaid diagram nodes and edges as graph evidence
  let mermaidMatch: RegExpExecArray | null;
  while ((mermaidMatch = MERMAID_BLOCK_RE.exec(content)) !== null) {
    const diagram = mermaidMatch[1];
    let edgeMatch: RegExpExecArray | null;
    MERMAID_EDGE_RE.lastIndex = 0;
    while ((edgeMatch = MERMAID_EDGE_RE.exec(diagram)) !== null) {
      const fromName = edgeMatch[1].trim();
      const toName = edgeMatch[2].trim();
      if (!fromName || !toName) continue;

      for (const nodeName of [fromName, toName]) {
        const key = `Object::diagram::${nodeName}`;
        if (!entityMap.has(key)) {
          entityMap.set(key, { name: nodeName, type: 'Object', subtype: 'diagram-node', confidence: 0.9 });
        }
      }

      relations.push({
        fromName,
        toName,
        type: 'depends_on',
        method: 'diagram',
        excerpt: edgeMatch[0].trim(),
        confidence: 0.9,
      });
    }
  }

  // 6. Extract folder entities and relations
  if (folderPath && folderPath.length > 0) {
    for (let i = 0; i < folderPath.length; i++) {
      const folderName = folderPath[i];
      const key = `folder::${folderName}`;
      if (!entityMap.has(key)) {
        entityMap.set(key, { name: folderName, type: 'folder', confidence: 1.0 });
      }

      // child_of relation between nested folders
      if (i > 0) {
        const parentName = folderPath[i - 1];
        relations.push({ fromName: folderName, toName: parentName, type: 'child_of' });
      }
    }

    // contains relation: innermost folder -> note
    const innermostFolder = folderPath[folderPath.length - 1];
    relations.push({ fromName: innermostFolder, toName: title, type: 'contains' });
  }

  // 7. Extract Event entities from date patterns and temporal markers
  const contentLower = content.toLowerCase();
  for (const pattern of DATE_PATTERNS) {
    let dateMatch: RegExpExecArray | null;
    while ((dateMatch = pattern.exec(content)) !== null) {
      const dateName = dateMatch[0];
      const key = `Event::${dateName}`;
      if (!entityMap.has(key)) {
        entityMap.set(key, { name: dateName, type: 'Event', confidence: 0.75 });
        relations.push({ fromName: dateName, toName: title, type: 'mentioned_in' });
      }
    }
  }

  let temporalMatch: RegExpExecArray | null;
  while ((temporalMatch = TEMPORAL_MARKERS.exec(content)) !== null) {
    // Look for a contextual name around the temporal marker
    const markerWord = temporalMatch[1];
    const startIdx = Math.max(0, temporalMatch.index - 30);
    const endIdx = Math.min(content.length, temporalMatch.index + temporalMatch[0].length + 30);
    const context = content.slice(startIdx, endIdx);
    // Extract a phrase around the marker (capitalize first letter)
    const phraseMatch = context.match(/([A-Z][a-zA-Z\s]+(?:meeting|deadline|milestone|conference|workshop|sprint|release|launch|event|ceremony|presentation|demo|review|standup|retrospective|kickoff))/i);
    if (phraseMatch) {
      const eventName = phraseMatch[1].trim();
      if (eventName.length > 3 && eventName.length < 60) {
        const key = `Event::${eventName.toLowerCase()}`;
        if (!entityMap.has(key)) {
          entityMap.set(key, { name: eventName, type: 'Event', confidence: 0.7 });
          relations.push({ fromName: eventName, toName: title, type: 'mentioned_in' });
        }
      }
    }
  }

  // 8. Extract Object entities from tool/framework patterns
  let toolMatch: RegExpExecArray | null;
  while ((toolMatch = TOOL_PATTERNS.exec(content)) !== null) {
    const toolName = toolMatch[1].trim();
    if (toolName.length >= 2 && toolName.length < 40) {
      const key = `Object::${toolName.toLowerCase()}`;
      if (!entityMap.has(key)) {
        entityMap.set(key, { name: toolName, type: 'Object', confidence: 0.7 });
        relations.push({ fromName: toolName, toName: title, type: 'mentioned_in' });
      }
    }
  }

  return {
    entities: Array.from(entityMap.values()),
    relations,
  };
}

/**
 * NLP-based named entity extraction using @xenova/transformers NER pipeline.
 * Extracts person, organization, and location entities from text.
 * Returns additional entities found beyond what regex extraction captures.
 */
let nerPipeline: any = null;
let nerLoadPromise: Promise<void> | null = null;

async function loadNERPipeline(): Promise<void> {
  if (nerPipeline) return;
  if (nerLoadPromise) return nerLoadPromise;

  nerLoadPromise = (async () => {
    try {
      const { pipeline, env } = await import('@xenova/transformers');
      // Skip Transformers.js' default /models/... probe. In dev, those probes
      // show up as noisy 404s before the library falls back to Hugging Face.
      env.allowLocalModels = false;
      nerPipeline = await pipeline('token-classification', 'Xenova/bert-base-NER');
    } catch (e) {
      console.warn('[NER] Failed to load NER pipeline:', e);
      nerPipeline = null;
    }
  })();

  return nerLoadPromise;
}

const NER_LABEL_MAP: Record<string, { type: EntityType; subtype?: string }> = {
  'B-PER': { type: 'Person' },
  'I-PER': { type: 'Person' },
  'B-ORG': { type: 'Person', subtype: 'organization' },
  'I-ORG': { type: 'Person', subtype: 'organization' },
  'B-LOC': { type: 'Location' },
  'I-LOC': { type: 'Location' },
};

interface NERToken {
  entity: string;
  score: number;
  word: string;
  start: number;
  end: number;
}

/**
 * Run NER on note content and return extracted entities + relations to the note.
 * Call this as an enhancement pass after regex extraction.
 */
export async function extractNEREntities(
  noteTitle: string,
  content: string
): Promise<{
  entities: ExtractedEntity[];
  relations: ExtractedRelation[];
}> {
  await loadNERPipeline();
  if (!nerPipeline) return { entities: [], relations: [] };

  // Truncate to avoid OOM with very long notes (BERT has 512 token limit)
  const text = content.slice(0, 5000);

  try {
    const results: NERToken[] = await nerPipeline(text);

    // Merge consecutive tokens of the same entity type (B-PER, I-PER -> full name)
    const merged: Array<{ name: string; type: EntityType; subtype?: string; score: number }> = [];
    let current: { name: string; type: EntityType; subtype?: string; score: number } | null = null;

    for (const token of results) {
      const labelInfo = NER_LABEL_MAP[token.entity];
      if (!labelInfo) {
        if (current) {
          merged.push(current);
          current = null;
        }
        continue;
      }

      const isBegin = token.entity.startsWith('B-');
      const word = token.word.replace(/^##/, ''); // Handle BERT subwords

      if (isBegin || !current || current.type !== labelInfo.type) {
        if (current) merged.push(current);
        current = { name: word, type: labelInfo.type, subtype: labelInfo.subtype, score: token.score };
      } else {
        // Continuation token — append to current entity
        current.name += (token.word.startsWith('##') ? '' : ' ') + word;
        current.score = Math.min(current.score, token.score);
      }
    }
    if (current) merged.push(current);

    // Deduplicate and filter low-confidence / short entities
    const seen = new Set<string>();
    const entities: ExtractedEntity[] = [];
    const relations: ExtractedRelation[] = [];

    for (const ent of merged) {
      const normalized = ent.name.trim();
      if (normalized.length < 2 || ent.score < 0.5) continue;
      const key = `${ent.type}::${normalized.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      entities.push({ name: normalized, type: ent.type, subtype: ent.subtype, confidence: ent.score });
      relations.push({ fromName: normalized, toName: noteTitle, type: 'mentioned_in' });
    }

    return { entities, relations };
  } catch (e) {
    console.warn('[NER] Extraction failed:', e);
    return { entities: [], relations: [] };
  }
}
