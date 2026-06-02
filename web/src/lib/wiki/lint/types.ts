import type { WikiPageRecord } from '$lib/wiki/types';

export type WikiLintSeverity = 'info' | 'warning' | 'error';
export type WikiLintFindingType = 'orphan-page' | 'broken-link' | 'stale-page' | 'contradiction';

export interface WikiLintFinding {
  id: string;
  type: WikiLintFindingType;
  severity: WikiLintSeverity;
  message: string;
  action: string;
  pageId?: string;
  pageIds?: string[];
  target?: string;
}

export interface WikiLintSummary {
  total: number;
  errors: number;
  warnings: number;
  info: number;
}

export interface WikiLintResult {
  summary: WikiLintSummary;
  findings: WikiLintFinding[];
}

export function summarizeFindings(findings: WikiLintFinding[]): WikiLintSummary {
  return {
    total: findings.length,
    errors: findings.filter((finding) => finding.severity === 'error').length,
    warnings: findings.filter((finding) => finding.severity === 'warning').length,
    info: findings.filter((finding) => finding.severity === 'info').length,
  };
}

export function isSystemPage(page: WikiPageRecord): boolean {
  return page.pageType === 'index' || page.pageType === 'log';
}
