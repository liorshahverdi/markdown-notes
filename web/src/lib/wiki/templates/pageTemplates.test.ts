import { describe, expect, it } from 'vitest';
import { buildSourceSummaryPage, buildWikiIndexPage, buildWikiLogPage } from './pageTemplates';

describe('buildSourceSummaryPage', () => {
  it('builds a source-summary page with required sections and citation metadata', () => {
    const page = buildSourceSummaryPage({
      pageId: 'page-1',
      sourceId: 'source-1',
      title: 'LLM Wiki Notes',
      slug: 'llm-wiki-notes',
      sourceType: 'note',
      rawPath: 'raw/2026/llm-wiki-notes.md',
      importedAt: 1717286400000,
      excerpt: 'Compiled knowledge should be persistent and editable.'
    });

    expect(page.record.pageType).toBe('source-summary');
    expect(page.record.sourceIds).toEqual(['source-1']);
    expect(page.record.wikiPath).toBe('wiki/sources/llm-wiki-notes.md');
    expect(page.markdown).toContain('pageType: source-summary');
    expect(page.markdown).toContain('sourceIds:');
    expect(page.markdown).toContain('## Summary');
    expect(page.markdown).toContain('## Key Excerpts');
    expect(page.markdown).toContain('[[raw/2026/llm-wiki-notes.md]]');
  });
});

describe('wiki utility templates', () => {
  it('builds deterministic index and log pages', () => {
    const indexPage = buildWikiIndexPage(['[[sources/llm-wiki-notes]]']);
    const logPage = buildWikiLogPage(['- 2026-06-01 imported [[sources/llm-wiki-notes]]']);

    expect(indexPage.record.pageType).toBe('index');
    expect(indexPage.markdown).toContain('# Wiki Index');
    expect(indexPage.markdown).toContain('[[sources/llm-wiki-notes]]');

    expect(logPage.record.pageType).toBe('log');
    expect(logPage.markdown).toContain('# Wiki Log');
    expect(logPage.markdown).toContain('2026-06-01 imported');
  });
});
