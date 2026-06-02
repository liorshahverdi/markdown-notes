import type { WikiLintFinding } from './types';

export interface DetectBrokenWikiLinksInput {
  existingWikiPaths: string[];
  markdownByPageId: Map<string, string>;
}

const WIKI_LINK_PATTERN = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;

function normalizeTargetToWikiPath(target: string): string {
  const withoutLeadingWiki = target.replace(/^wiki\//, '');
  return `wiki/${withoutLeadingWiki.replace(/\.md$/, '')}.md`;
}

export function detectBrokenWikiLinks(input: DetectBrokenWikiLinksInput): WikiLintFinding[] {
  const existing = new Set(input.existingWikiPaths);
  const findings: WikiLintFinding[] = [];

  for (const [pageId, markdown] of input.markdownByPageId) {
    const seenTargets = new Set<string>();
    for (const match of markdown.matchAll(WIKI_LINK_PATTERN)) {
      const target = match[1].trim();
      if (!target || seenTargets.has(target)) continue;
      seenTargets.add(target);
      const wikiPath = normalizeTargetToWikiPath(target);
      if (!existing.has(wikiPath)) {
        findings.push({
          id: `broken-link:${pageId}:${target}`,
          type: 'broken-link',
          severity: 'error',
          pageId,
          target,
          message: `Missing wiki link ${target}`,
          action: 'Create the missing page or update/remove the wiki link.',
        });
      }
    }
  }

  return findings;
}
