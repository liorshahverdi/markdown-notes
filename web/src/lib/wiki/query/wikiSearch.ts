import type Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readVaultTextFile } from '$lib/server/vaultFs';
import { getUserVaultPaths } from '$lib/server/vaultPaths';

export type WikiCoverage = 'strong' | 'weak';
export type WikiSearchSourceKind = 'wiki-page' | 'raw-source';

export interface WikiSearchResult {
  id: string;
  title: string;
  wikiPath: string;
  sourceKind: WikiSearchSourceKind;
  score: number;
  excerpt: string;
}

export interface WikiFirstSearchResult {
  results: WikiSearchResult[];
  coverage: WikiCoverage;
  usedRawFallback: boolean;
}

export interface SearchWikiFirstInput {
  db: Database.Database;
  userId: string;
  baseDir: string;
  query: string;
  topK?: number;
}

interface WikiPageRow {
  id: string;
  title: string;
  slug: string;
  pageType: string;
  wikiPath: string;
  summary: string;
  sourceIdsJson: string;
  entityKeysJson: string;
}

interface RawSourceRow {
  id: string;
  title: string;
  slug: string;
  rawPath: string;
}

const STOP_WORDS = new Set(['the', 'and', 'about', 'what', 'where', 'when', 'who', 'why', 'how', 'with', 'from', 'this', 'that', 'are', 'was', 'were', 'tell', 'explain']);

function queryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term));
}

function scoreText(query: string, text: string, title = '', slug = ''): number {
  const terms = queryTerms(query);
  if (terms.length === 0) return 0;
  const lowerText = text.toLowerCase();
  const lowerTitle = title.toLowerCase();
  const lowerSlug = slug.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (lowerTitle.includes(term)) score += 3;
    if (lowerSlug.includes(term)) score += 2;
    if (lowerText.includes(term)) score += 1;
  }
  return score / terms.length;
}

function excerptFor(content: string, query: string, maxLength = 280): string {
  if (content.length <= maxLength) return content;
  const terms = queryTerms(query);
  const lower = content.toLowerCase();
  const hit = terms.map((term) => lower.indexOf(term)).filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, hit - Math.floor(maxLength / 3));
  return content.slice(start, start + maxLength).trim();
}

function safeReadVaultText(vaultRoot: string, relativePath: string): string {
  const absolutePath = join(vaultRoot, relativePath);
  if (!existsSync(absolutePath)) return '';
  return readVaultTextFile(vaultRoot, relativePath);
}

function parseSourceIds(sourceIdsJson: string): string[] {
  try {
    const sourceIds = JSON.parse(sourceIdsJson) as unknown;
    return Array.isArray(sourceIds) ? sourceIds.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function linkedRawSourceContext(input: SearchWikiFirstInput, vaultRoot: string, sourceIds: string[], query: string): string {
  if (sourceIds.length === 0) return '';
  const rows = input.db
    .prepare(`
      SELECT id, title, slug, rawPath
      FROM raw_sources
      WHERE userId = ? AND status = ?
    `)
    .all(input.userId, 'ingested') as RawSourceRow[];
  const sourceIdSet = new Set(sourceIds);
  const excerpts = rows
    .filter((row) => sourceIdSet.has(row.id))
    .map((row) => {
      const rawText = safeReadVaultText(vaultRoot, row.rawPath);
      if (!rawText) return '';
      return [
        `Supporting raw source: [raw-source:${row.id}] ${row.title}`,
        `Path: ${row.rawPath}`,
        excerptFor(rawText, query, 1200),
      ].join('\n');
    })
    .filter(Boolean);

  return excerpts.length > 0 ? excerpts.join('\n\n') : '';
}

function searchWikiPages(input: SearchWikiFirstInput, vaultRoot: string): WikiSearchResult[] {
  const rows = input.db
    .prepare('SELECT id, title, slug, pageType, wikiPath, summary, sourceIdsJson, entityKeysJson FROM wiki_pages WHERE userId = ? AND pageType NOT IN (?, ?)')
    .all(input.userId, 'index', 'log') as WikiPageRow[];

  return rows
    .map((row) => {
      const markdown = safeReadVaultText(vaultRoot, row.wikiPath);
      const entityKeys = JSON.parse(row.entityKeysJson) as string[];
      const sourceIds = parseSourceIds(row.sourceIdsJson);
      const supportingRawContext = linkedRawSourceContext(input, vaultRoot, sourceIds, input.query);
      const corpus = `${row.title}\n${row.slug}\n${row.summary}\n${entityKeys.join('\n')}\n${markdown}\n${supportingRawContext}`;
      const score = scoreText(input.query, corpus, row.title, row.slug);
      const primaryExcerpt = excerptFor(markdown || row.summary, input.query);
      return {
        id: row.id,
        title: row.title,
        wikiPath: row.wikiPath,
        sourceKind: 'wiki-page' as const,
        score,
        excerpt: supportingRawContext ? `${primaryExcerpt}\n\nLinked supporting raw-source details:\n${supportingRawContext}` : primaryExcerpt,
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function searchRawSources(input: SearchWikiFirstInput, vaultRoot: string): WikiSearchResult[] {
  const rows = input.db
    .prepare('SELECT id, title, slug, rawPath FROM raw_sources WHERE userId = ? AND status = ?')
    .all(input.userId, 'ingested') as RawSourceRow[];

  return rows
    .map((row) => {
      const rawText = safeReadVaultText(vaultRoot, row.rawPath);
      return {
        id: row.id,
        title: row.title,
        wikiPath: row.rawPath,
        sourceKind: 'raw-source' as const,
        score: scoreText(input.query, `${row.title}\n${row.slug}\n${rawText}`, row.title, row.slug),
        excerpt: excerptFor(rawText, input.query),
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

export function searchWikiFirst(input: SearchWikiFirstInput): WikiFirstSearchResult {
  const topK = input.topK ?? 5;
  const vaultRoot = getUserVaultPaths(input.userId, input.baseDir).root;
  const wikiResults = searchWikiPages(input, vaultRoot);
  const coverage: WikiCoverage = wikiResults.length > 0 && wikiResults[0].score >= 1 ? 'strong' : 'weak';
  const rawResults = coverage === 'weak' ? searchRawSources(input, vaultRoot) : [];

  return {
    results: [...wikiResults, ...rawResults].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, topK),
    coverage,
    usedRawFallback: rawResults.length > 0,
  };
}
