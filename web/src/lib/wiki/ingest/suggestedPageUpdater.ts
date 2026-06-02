import type Database from 'better-sqlite3';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { WikiPageRecord } from '$lib/wiki/types';
import { serializeMarkdownWithFrontmatter } from '$lib/server/vaultFrontmatter';
import { getUserVaultPaths } from '$lib/server/vaultPaths';
import { saveWikiPage } from '$lib/wiki/wikiPageRepository';
import type { PageSuggestion } from './pageSuggestionBuilder';

export interface UpsertSuggestedPagesInput {
  db: Database.Database;
  userId: string;
  baseDir: string;
  sourceId: string;
  sourceTitle: string;
  suggestions: PageSuggestion[];
}

export interface UpsertSuggestedPagesResult {
  changedPageIds: string[];
  createdPageIds: string[];
}

function sourceLink(sourceId: string, sourceTitle: string): string {
  return `[[sources/${sourceId}|${sourceTitle}]]`;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function parseExistingSourceLinks(markdown: string | null): string[] {
  if (!markdown) return [];
  return markdown
    .split('\n')
    .map((line) => line.trim().replace(/^-\s+/, ''))
    .filter((line) => line.startsWith('[[sources/'));
}

function existingPage(db: Database.Database, userId: string, pageType: string, slug: string): WikiPageRecord | null {
  const row = db
    .prepare('SELECT id, title, slug, pageType, wikiPath, summary, backlinksJson, sourceIdsJson, entityKeysJson, lastUpdatedAt, lastUpdatedReason, confidence, openQuestionsJson FROM wiki_pages WHERE userId = ? AND pageType = ? AND slug = ?')
    .get(userId, pageType, slug) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    title: row.title as string,
    slug: row.slug as string,
    pageType: row.pageType as WikiPageRecord['pageType'],
    wikiPath: row.wikiPath as string,
    summary: row.summary as string,
    backlinks: JSON.parse(row.backlinksJson as string),
    sourceIds: JSON.parse(row.sourceIdsJson as string),
    entityKeys: JSON.parse(row.entityKeysJson as string),
    lastUpdatedAt: row.lastUpdatedAt as number,
    lastUpdatedReason: row.lastUpdatedReason as WikiPageRecord['lastUpdatedReason'],
    confidence: row.confidence as WikiPageRecord['confidence'],
    openQuestions: JSON.parse(row.openQuestionsJson as string),
  };
}

function readExistingMarkdown(userId: string, baseDir: string, wikiPath: string): string | null {
  const absolutePath = join(getUserVaultPaths(userId, baseDir).root, wikiPath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, 'utf-8') : null;
}

export function buildSuggestedPageMarkdown(input: {
  record: WikiPageRecord;
  sourceLinks: string[];
  relatedEntityKeys: string[];
}): string {
  const body = [
    `# ${input.record.title}`,
    '',
    '## Summary',
    '',
    input.record.summary,
    '',
    '## Sources',
    '',
    ...input.sourceLinks.map((link) => `- ${link}`),
    '',
    '## Related Entity Keys',
    '',
    ...(input.relatedEntityKeys.length > 0 ? input.relatedEntityKeys.map((key) => `- ${key}`) : ['- None yet']),
    '',
    '## Open Questions',
    '',
    '- What should this page link to next?',
    '',
  ].join('\n');

  return serializeMarkdownWithFrontmatter(
    {
      pageType: input.record.pageType,
      title: input.record.title,
      summary: input.record.summary,
      sourceIds: input.record.sourceIds,
      backlinks: input.record.backlinks,
      entityKeys: input.record.entityKeys,
      lastUpdatedAt: String(input.record.lastUpdatedAt),
      lastUpdatedReason: input.record.lastUpdatedReason,
      confidence: input.record.confidence ?? 'medium',
      openQuestions: input.record.openQuestions ?? [],
    },
    body
  );
}

export function upsertSuggestedPages(input: UpsertSuggestedPagesInput, pageType: 'entity' | 'concept'): UpsertSuggestedPagesResult {
  const changedPageIds: string[] = [];
  const createdPageIds: string[] = [];

  for (const suggestion of input.suggestions.filter((item) => item.pageType === pageType)) {
    const existing = existingPage(input.db, input.userId, pageType, suggestion.slug);
    const id = existing?.id ?? `${pageType}-${suggestion.slug}`;
    const wikiPath = `wiki/${pageType === 'entity' ? 'entities' : 'concepts'}/${suggestion.slug}.md`;
    const record: WikiPageRecord = {
      id,
      title: suggestion.title,
      slug: suggestion.slug,
      pageType,
      wikiPath,
      summary: suggestion.summary,
      backlinks: uniqueSorted([...(existing?.backlinks ?? []), 'index']),
      sourceIds: uniqueSorted([...(existing?.sourceIds ?? []), ...suggestion.sourceIds, input.sourceId]),
      entityKeys: uniqueSorted([...(existing?.entityKeys ?? []), ...suggestion.entityKeys]),
      lastUpdatedAt: Date.now(),
      lastUpdatedReason: 'ingest',
      confidence: 'medium',
      openQuestions: ['What related wiki pages should be connected next?'],
    };

    const previousLinks = existing ? parseExistingSourceLinks(readExistingMarkdown(input.userId, input.baseDir, existing.wikiPath)) : [];
    const sourceLinks = uniqueSorted([...previousLinks, sourceLink(input.sourceId, input.sourceTitle)]);

    saveWikiPage({
      db: input.db,
      userId: input.userId,
      baseDir: input.baseDir,
      record,
      markdown: buildSuggestedPageMarkdown({ record, sourceLinks, relatedEntityKeys: suggestion.relatedEntityKeys }),
    });

    changedPageIds.push(record.id);
    if (!existing) createdPageIds.push(record.id);
  }

  return { changedPageIds, createdPageIds };
}
