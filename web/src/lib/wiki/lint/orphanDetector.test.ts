import { describe, expect, it } from 'vitest';
import { detectOrphanPages } from './orphanDetector';
import type { WikiPageRecord } from '$lib/wiki/types';

function page(overrides: Partial<WikiPageRecord>): WikiPageRecord {
  return {
    id: 'entity-ada',
    title: 'Ada Lovelace',
    slug: 'ada-lovelace',
    pageType: 'entity',
    wikiPath: 'wiki/entities/ada-lovelace.md',
    summary: 'Ada summary',
    backlinks: [],
    sourceIds: [],
    entityKeys: [],
    lastUpdatedAt: Date.now(),
    lastUpdatedReason: 'ingest',
    confidence: 'medium',
    openQuestions: [],
    ...overrides,
  };
}

describe('detectOrphanPages', () => {
  it('flags actionable non-system pages with no backlinks or sources', () => {
    const findings = detectOrphanPages([
      page({ id: 'entity-ada', backlinks: [], sourceIds: [] }),
      page({ id: 'index', pageType: 'index', wikiPath: 'wiki/index.md', backlinks: [], sourceIds: [] }),
      page({ id: 'concept-symbols', pageType: 'concept', backlinks: ['entity-ada'], sourceIds: [] }),
    ]);

    expect(findings).toEqual([
      expect.objectContaining({
        id: 'orphan:entity-ada',
        type: 'orphan-page',
        severity: 'warning',
        pageId: 'entity-ada',
        action: 'Add backlinks, attach sources, or archive this page.',
      }),
    ]);
  });
});
