import { randomUUID } from 'node:crypto';
import type { RawSourceRecord } from '$lib/wiki/types';
import { buildSourceSummaryPage, type BuiltWikiPage } from '$lib/wiki/templates/pageTemplates';

export interface GenerateSourceSummaryPageInput {
  source: RawSourceRecord;
  sourceText: string;
}

function summarizeSourceText(sourceText: string): string {
  const normalized = sourceText
    .replace(/^#+\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized.slice(0, 180) || 'No summary available.';
}

export function generateSourceSummaryPage(input: GenerateSourceSummaryPageInput): BuiltWikiPage {
  return buildSourceSummaryPage({
    pageId: randomUUID(),
    sourceId: input.source.id,
    title: input.source.title,
    slug: input.source.slug,
    sourceType: input.source.sourceType,
    rawPath: input.source.rawPath,
    importedAt: input.source.importedAt,
    excerpt: summarizeSourceText(input.sourceText),
  });
}
