import type { WikiPageRecord } from '$lib/wiki/types';
import { isSystemPage, type WikiLintFinding } from './types';

export function detectOrphanPages(pages: WikiPageRecord[]): WikiLintFinding[] {
  return pages
    .filter((page) => !isSystemPage(page))
    .filter((page) => page.backlinks.length === 0 && page.sourceIds.length === 0)
    .map((page) => ({
      id: `orphan:${page.id}`,
      type: 'orphan-page',
      severity: 'warning',
      pageId: page.id,
      message: `${page.title} has no backlinks or source citations.`,
      action: 'Add backlinks, attach sources, or archive this page.',
    }));
}
