import { describe, expect, it } from 'vitest';
import { generateSourceSummaryPage } from './sourceSummarizer';

describe('generateSourceSummaryPage', () => {
  it('creates a source-summary payload from source content', () => {
    const page = generateSourceSummaryPage({
      source: {
        id: 'source-1',
        title: 'LLM Wiki Notes',
        slug: 'llm-wiki-notes',
        sourceType: 'note',
        rawPath: 'raw/2026/llm-wiki-notes.md',
        assetPaths: [],
        importedAt: 1717286400000,
        status: 'queued',
        summaryPageId: null,
        tags: [],
      },
      sourceText: '# LLM Wiki\n\nCompiled knowledge should be persistent and editable.\n\nIt should grow through updates.',
    });

    expect(page.record.title).toBe('LLM Wiki Notes');
    expect(page.record.pageType).toBe('source-summary');
    expect(page.record.summary).toContain('Compiled knowledge should be persistent');
    expect(page.markdown).toContain('## Summary');
    expect(page.markdown).toContain('## Open Questions');
    expect(page.markdown).toContain('[[raw/2026/llm-wiki-notes.md]]');
  });
});
