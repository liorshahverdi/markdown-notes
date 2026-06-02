import { describe, expect, it } from 'vitest';
import { detectStalePages } from './stalenessDetector';
import type { WikiPageRecord } from '$lib/wiki/types';

function page(overrides: Partial<WikiPageRecord>): WikiPageRecord {
  return {
    id: 'question-old',
    title: 'Old Question',
    slug: 'old-question',
    pageType: 'question',
    wikiPath: 'wiki/questions/old-question.md',
    summary: 'Old answer',
    backlinks: ['entity-ada'],
    sourceIds: [],
    entityKeys: [],
    lastUpdatedAt: 0,
    lastUpdatedReason: 'query-filed',
    confidence: 'low',
    openQuestions: ['Needs review'],
    ...overrides,
  };
}

describe('detectStalePages', () => {
  it('flags old low-confidence pages and ignores system pages', () => {
    const now = Date.UTC(2026, 0, 31);
    const findings = detectStalePages([
      page({ id: 'question-old', lastUpdatedAt: now - 1000 * 60 * 60 * 24 * 45, confidence: 'low' }),
      page({ id: 'index', pageType: 'index', wikiPath: 'wiki/index.md', lastUpdatedAt: 0, confidence: 'low' }),
    ], { now, maxAgeDays: 30 });

    expect(findings).toEqual([
      expect.objectContaining({
        id: 'stale:question-old',
        type: 'stale-page',
        severity: 'warning',
        pageId: 'question-old',
        action: 'Review this page, refresh citations, or raise its confidence.',
      }),
    ]);
  });
});
