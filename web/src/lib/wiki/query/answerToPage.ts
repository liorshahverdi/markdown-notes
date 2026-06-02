import { serializeMarkdownWithFrontmatter } from '$lib/server/vaultFrontmatter';
import type { WikiPageRecord } from '$lib/wiki/types';
import type { WikiCitation } from './queryPipeline';
import type { WikiCoverage } from './wikiSearch';

export interface DraftAnswerPageUpdateInput {
  question: string;
  answer: string;
  citations: WikiCitation[];
  coverage: WikiCoverage;
  usedRawFallback: boolean;
  timestamp?: number;
}

export interface DraftAnswerPageUpdateResult {
  record: WikiPageRecord;
  markdown: string;
}

export function slugifyQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'filed-answer';
}

function citationToWikiLink(citation: WikiCitation): string {
  if (citation.kind === 'wiki-page' && citation.wikiPath.startsWith('wiki/')) {
    const linkPath = citation.wikiPath.replace(/^wiki\//, '').replace(/\.md$/, '');
    return `[[${linkPath}|${citation.title}]]`;
  }
  return `[${citation.kind}:${citation.id}] ${citation.title}`;
}

function citationEntityKeys(citations: WikiCitation[]): string[] {
  return citations
    .filter((citation) => citation.kind === 'wiki-page')
    .map((citation) => citation.id)
    .sort();
}

export function draftAnswerPageUpdate(input: DraftAnswerPageUpdateInput): DraftAnswerPageUpdateResult {
  const slug = slugifyQuestion(input.question);
  const timestamp = input.timestamp ?? Date.now();
  const record: WikiPageRecord = {
    id: `question-${slug}`,
    title: input.question,
    slug,
    pageType: 'question',
    wikiPath: `wiki/questions/${slug}.md`,
    summary: input.answer.slice(0, 240),
    backlinks: input.citations.filter((citation) => citation.kind === 'wiki-page').map((citation) => citation.id).sort(),
    sourceIds: input.citations.filter((citation) => citation.kind === 'raw-source').map((citation) => citation.id).sort(),
    entityKeys: citationEntityKeys(input.citations),
    lastUpdatedAt: timestamp,
    lastUpdatedReason: 'query-filed',
    confidence: input.coverage === 'strong' && !input.usedRawFallback ? 'high' : 'medium',
    openQuestions: [],
  };

  const body = [
    `# ${input.question}`,
    '',
    '## Answer',
    '',
    input.answer,
    '',
    '## Filing Context',
    '',
    `- Wiki coverage: ${input.coverage}`,
    `- Raw-source fallback used: ${input.usedRawFallback ? 'yes' : 'no'}`,
    '',
    '## Citations',
    '',
    ...(input.citations.length > 0 ? input.citations.map((citation) => `- ${citationToWikiLink(citation)}`) : ['- None']),
    '',
  ].join('\n');

  return {
    record,
    markdown: serializeMarkdownWithFrontmatter(
      {
        pageType: record.pageType,
        title: record.title,
        summary: record.summary,
        sourceIds: record.sourceIds,
        backlinks: record.backlinks,
        entityKeys: record.entityKeys,
        lastUpdatedAt: String(record.lastUpdatedAt),
        lastUpdatedReason: record.lastUpdatedReason,
        confidence: record.confidence ?? 'medium',
        openQuestions: record.openQuestions ?? [],
      },
      body
    ),
  };
}
