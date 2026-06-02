import type Database from 'better-sqlite3';
import { buildWikiIndexPage, type BuiltWikiPage } from '$lib/wiki/templates/pageTemplates';
import { saveWikiPage } from '$lib/wiki/wikiPageRepository';

interface WikiPageIndexRow {
  id: string;
  title: string;
  slug: string;
  pageType: string;
  wikiPath: string;
}

export interface UpdateWikiIndexInput {
  db: Database.Database;
  userId: string;
  baseDir: string;
}

const TYPE_LABELS: Record<string, string> = {
  concept: 'Concepts',
  entity: 'Entities',
  'source-summary': 'Source Summaries',
  topic: 'Topics',
  comparison: 'Comparisons',
  timeline: 'Timelines',
  question: 'Questions',
  synthesis: 'Syntheses',
};

function pageLink(row: WikiPageIndexRow): string {
  const withoutWikiPrefix = row.wikiPath.replace(/^wiki\//, '').replace(/\.md$/, '');
  return `- [[${withoutWikiPrefix}|${row.title}]]`;
}

export function buildWikiIndexEntries(rows: WikiPageIndexRow[]): string[] {
  const groups = new Map<string, WikiPageIndexRow[]>();

  for (const row of rows) {
    if (row.pageType === 'index' || row.pageType === 'log') continue;
    const items = groups.get(row.pageType) ?? [];
    items.push(row);
    groups.set(row.pageType, items);
  }

  const entries: string[] = [];
  for (const pageType of [...groups.keys()].sort()) {
    const label = TYPE_LABELS[pageType] ?? pageType;
    entries.push(`## ${label}`, '');
    for (const row of (groups.get(pageType) ?? []).sort((a, b) => a.title.localeCompare(b.title))) {
      entries.push(pageLink(row));
    }
    entries.push('');
  }

  return entries;
}

export function updateWikiIndex(input: UpdateWikiIndexInput): BuiltWikiPage {
  const rows = input.db
    .prepare('SELECT id, title, slug, pageType, wikiPath FROM wiki_pages WHERE userId = ?')
    .all(input.userId) as WikiPageIndexRow[];

  const page = buildWikiIndexPage(buildWikiIndexEntries(rows));
  saveWikiPage({
    db: input.db,
    userId: input.userId,
    baseDir: input.baseDir,
    record: page.record,
    markdown: page.markdown,
  });

  return page;
}
