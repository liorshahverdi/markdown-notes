import type { WikiLintFinding } from './types';

interface ClaimOccurrence {
  pageId: string;
  value: string;
}

const CLAIM_PATTERN = /^\s*Claim:\s*([^=\n]+?)\s*=\s*(true|false)\s*$/gim;

export function detectContradictoryClaims(markdownByPageId: Map<string, string>): WikiLintFinding[] {
  const claims = new Map<string, ClaimOccurrence[]>();

  for (const [pageId, markdown] of markdownByPageId) {
    for (const match of markdown.matchAll(CLAIM_PATTERN)) {
      const key = match[1].trim().toLowerCase();
      const value = match[2].trim().toLowerCase();
      const occurrences = claims.get(key) ?? [];
      occurrences.push({ pageId, value });
      claims.set(key, occurrences);
    }
  }

  const findings: WikiLintFinding[] = [];
  for (const [key, occurrences] of claims) {
    const values = new Set(occurrences.map((occurrence) => occurrence.value));
    if (values.size > 1) {
      findings.push({
        id: `contradiction:${key}`,
        type: 'contradiction',
        severity: 'error',
        pageIds: [...new Set(occurrences.map((occurrence) => occurrence.pageId))],
        message: `Conflicting claim values found for ${key}.`,
        action: 'Review conflicting claims and either reconcile them or add provenance/context.',
      });
    }
  }

  return findings.sort((a, b) => a.id.localeCompare(b.id));
}
