import type Database from 'better-sqlite3';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getUserVaultPaths } from '$lib/server/vaultPaths';
import type { WikiPageRecord } from '$lib/wiki/types';
import { detectBrokenWikiLinks } from './brokenLinkDetector';
import { detectContradictoryClaims } from './contradictionDetector';
import { detectOrphanPages } from './orphanDetector';
import { detectStalePages } from './stalenessDetector';
import { summarizeFindings, type WikiLintFinding, type WikiLintResult } from './types';

export interface RunWikiLintInput {
  db: Database.Database;
  userId: string;
  baseDir: string;
  now?: number;
}

function parseJsonArray(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function readWikiPages(db: Database.Database, userId: string): WikiPageRecord[] {
  const rows = db
    .prepare('SELECT id, title, slug, pageType, wikiPath, summary, backlinksJson, sourceIdsJson, entityKeysJson, lastUpdatedAt, lastUpdatedReason, confidence, openQuestionsJson FROM wiki_pages WHERE userId = ? ORDER BY pageType, title')
    .all(userId) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: row.id as string,
    title: row.title as string,
    slug: row.slug as string,
    pageType: row.pageType as WikiPageRecord['pageType'],
    wikiPath: row.wikiPath as string,
    summary: row.summary as string,
    backlinks: parseJsonArray(row.backlinksJson),
    sourceIds: parseJsonArray(row.sourceIdsJson),
    entityKeys: parseJsonArray(row.entityKeysJson),
    lastUpdatedAt: row.lastUpdatedAt as number,
    lastUpdatedReason: row.lastUpdatedReason as WikiPageRecord['lastUpdatedReason'],
    confidence: row.confidence as WikiPageRecord['confidence'],
    openQuestions: parseJsonArray(row.openQuestionsJson),
  }));
}

function readMarkdownByPageId(pages: WikiPageRecord[], userId: string, baseDir: string): Map<string, string> {
  const vaultRoot = getUserVaultPaths(userId, baseDir).root;
  const markdownByPageId = new Map<string, string>();
  for (const page of pages) {
    const absolutePath = join(vaultRoot, page.wikiPath);
    markdownByPageId.set(page.id, existsSync(absolutePath) ? readFileSync(absolutePath, 'utf-8') : '');
  }
  return markdownByPageId;
}

function stableFindings(findings: WikiLintFinding[]): WikiLintFinding[] {
  const severityRank = { error: 0, warning: 1, info: 2 } as const;
  return [...findings].sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.id.localeCompare(b.id));
}

export function runWikiLint(input: RunWikiLintInput): WikiLintResult {
  const pages = readWikiPages(input.db, input.userId);
  const markdownByPageId = readMarkdownByPageId(pages, input.userId, input.baseDir);
  const findings = stableFindings([
    ...detectOrphanPages(pages),
    ...detectBrokenWikiLinks({ existingWikiPaths: pages.map((page) => page.wikiPath), markdownByPageId }),
    ...detectStalePages(pages, { now: input.now }),
    ...detectContradictoryClaims(markdownByPageId),
  ]);

  return { summary: summarizeFindings(findings), findings };
}
