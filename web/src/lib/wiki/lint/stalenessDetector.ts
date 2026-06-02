import type { WikiPageRecord } from '$lib/wiki/types';
import { isSystemPage, type WikiLintFinding } from './types';

export interface DetectStalePagesOptions {
  now?: number;
  maxAgeDays?: number;
}

export function detectStalePages(pages: WikiPageRecord[], options: DetectStalePagesOptions = {}): WikiLintFinding[] {
  const now = options.now ?? Date.now();
  const maxAgeMs = (options.maxAgeDays ?? 30) * 24 * 60 * 60 * 1000;

  return pages
    .filter((page) => !isSystemPage(page))
    .filter((page) => page.confidence === 'low' || (page.openQuestions ?? []).length > 0)
    .filter((page) => now - page.lastUpdatedAt > maxAgeMs)
    .map((page) => ({
      id: `stale:${page.id}`,
      type: 'stale-page',
      severity: 'warning',
      pageId: page.id,
      message: `${page.title} is stale or low-confidence and needs review.`,
      action: 'Review this page, refresh citations, or raise its confidence.',
    }));
}
