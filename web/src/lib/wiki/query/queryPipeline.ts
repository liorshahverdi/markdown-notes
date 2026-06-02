import type Database from 'better-sqlite3';
import { buildWikiAnswerMessages } from './wikiAnswerBuilder';
import { searchWikiFirst, type WikiCoverage, type WikiSearchResult } from './wikiSearch';
import type { ChatMessage } from '$lib/vector/ragPipeline';

export interface WikiCitation {
  id: string;
  title: string;
  kind: WikiSearchResult['sourceKind'];
  wikiPath: string;
  relevanceScore: number;
}

export interface WikiFirstQueryContext {
  messages: ChatMessage[];
  citations: WikiCitation[];
  coverage: WikiCoverage;
  usedRawFallback: boolean;
}

export interface BuildWikiFirstQueryContextInput {
  db: Database.Database;
  userId: string;
  baseDir: string;
  query: string;
  topK?: number;
}

export function buildWikiFirstQueryContext(input: BuildWikiFirstQueryContextInput): WikiFirstQueryContext {
  const search = searchWikiFirst(input);
  return {
    messages: buildWikiAnswerMessages({
      query: input.query,
      results: search.results,
      coverage: search.coverage,
      usedRawFallback: search.usedRawFallback,
    }),
    citations: search.results.map((result) => ({
      id: result.id,
      title: result.title,
      kind: result.sourceKind,
      wikiPath: result.wikiPath,
      relevanceScore: Math.min(1, result.score),
    })),
    coverage: search.coverage,
    usedRawFallback: search.usedRawFallback,
  };
}
