import type { ChatMessage } from '$lib/vector/ragPipeline';
import type { WikiCoverage, WikiSearchResult } from './wikiSearch';

export interface BuildWikiAnswerMessagesInput {
  query: string;
  results: WikiSearchResult[];
  coverage: WikiCoverage;
  usedRawFallback: boolean;
}

export function buildWikiAnswerMessages(input: BuildWikiAnswerMessagesInput): ChatMessage[] {
  const context = input.results
    .map((result, index) => [
      `Source ${index + 1}: [${result.sourceKind}:${result.id}] ${result.title}`,
      `Path: ${result.wikiPath}`,
      `Relevance: ${result.score.toFixed(2)}`,
      result.excerpt,
    ].join('\n'))
    .join('\n\n---\n\n');

  return [
    {
      role: 'system',
      content: 'You answer from a local LLM wiki. Always cite wiki pages first using [wiki-page:<id>] citations. Use [raw-source:<id>] citations only when wiki coverage is weak and fallback material is present. State when raw-source fallback was needed.',
    },
    {
      role: 'user',
      content: `Question: ${input.query}\n\nWiki coverage: ${input.coverage}\nRaw-source fallback used: ${input.usedRawFallback ? 'yes' : 'no'}\n\nWiki-first context:\n${context || 'No matching wiki context found.'}\n\nAnswer with citations from the context above.`,
    },
  ];
}
