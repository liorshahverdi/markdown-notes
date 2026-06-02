import type { RawSourceRecord, WikiPageRecord } from '$lib/wiki/types';
import { serializeMarkdownWithFrontmatter, type FrontmatterData } from '$lib/server/vaultFrontmatter';

export interface BuiltWikiPage {
  record: WikiPageRecord;
  markdown: string;
}

interface SourceSummaryTemplateInput {
  pageId: string;
  sourceId: string;
  title: string;
  slug: string;
  sourceType: RawSourceRecord['sourceType'];
  rawPath: string;
  importedAt: number;
  excerpt: string;
}

function baseFrontmatter(record: WikiPageRecord): FrontmatterData {
  return {
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
  };
}

export function buildSourceSummaryPage(input: SourceSummaryTemplateInput): BuiltWikiPage {
  const record: WikiPageRecord = {
    id: input.pageId,
    title: input.title,
    slug: input.slug,
    pageType: 'source-summary',
    wikiPath: `wiki/sources/${input.slug}.md`,
    summary: input.excerpt,
    backlinks: ['index'],
    sourceIds: [input.sourceId],
    entityKeys: [],
    lastUpdatedAt: input.importedAt,
    lastUpdatedReason: 'ingest',
    confidence: 'medium',
    openQuestions: ['What related entities and concepts should be linked next?'],
  };

  const body = [
    `# ${input.title}`,
    '',
    '## Summary',
    '',
    input.excerpt,
    '',
    '## Source Metadata',
    '',
    `- Source type: ${input.sourceType}`,
    `- Imported at: ${new Date(input.importedAt).toISOString()}`,
    `- Raw file: [[${input.rawPath}]]`,
    '',
    '## Key Excerpts',
    '',
    `> ${input.excerpt}`,
    '',
    '## Open Questions',
    '',
    '- What should this source connect to in the wider wiki?',
    '',
  ].join('\n');

  return {
    record,
    markdown: serializeMarkdownWithFrontmatter(baseFrontmatter(record), body),
  };
}

export function buildWikiIndexPage(entries: string[]): BuiltWikiPage {
  const record: WikiPageRecord = {
    id: 'wiki-index',
    title: 'Wiki Index',
    slug: 'index',
    pageType: 'index',
    wikiPath: 'wiki/index.md',
    summary: 'Top-level wiki navigation',
    backlinks: [],
    sourceIds: [],
    entityKeys: [],
    lastUpdatedAt: Date.now(),
    lastUpdatedReason: 'manual-review',
    confidence: 'high',
    openQuestions: [],
  };

  return {
    record,
    markdown: serializeMarkdownWithFrontmatter(baseFrontmatter(record), ['# Wiki Index', '', ...entries, ''].join('\n')),
  };
}

export function buildWikiLogPage(entries: string[]): BuiltWikiPage {
  const record: WikiPageRecord = {
    id: 'wiki-log',
    title: 'Wiki Log',
    slug: 'log',
    pageType: 'log',
    wikiPath: 'wiki/log.md',
    summary: 'Chronological wiki maintenance log',
    backlinks: [],
    sourceIds: [],
    entityKeys: [],
    lastUpdatedAt: Date.now(),
    lastUpdatedReason: 'manual-review',
    confidence: 'high',
    openQuestions: [],
  };

  return {
    record,
    markdown: serializeMarkdownWithFrontmatter(baseFrontmatter(record), ['# Wiki Log', '', ...entries, ''].join('\n')),
  };
}
