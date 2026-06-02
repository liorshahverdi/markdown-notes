import { describe, expect, it } from 'vitest';
import { buildWikiAnswerMessages } from './wikiAnswerBuilder';
import type { WikiSearchResult } from './wikiSearch';

describe('buildWikiAnswerMessages', () => {
  it('builds a wiki-first prompt with citations and explicit fallback state', () => {
    const results: WikiSearchResult[] = [
      {
        id: 'entity-ada',
        title: 'Ada Lovelace',
        wikiPath: 'wiki/entities/ada-lovelace.md',
        sourceKind: 'wiki-page',
        score: 1,
        excerpt: 'Ada Lovelace wrote about the Analytical Engine.',
      },
      {
        id: 'source-1',
        title: 'Raw Computing Notes',
        wikiPath: 'raw/2026/computing.md',
        sourceKind: 'raw-source',
        score: 0.5,
        excerpt: 'Raw note fallback text.',
      },
    ];

    const messages = buildWikiAnswerMessages({
      query: 'Who was Ada?',
      results,
      coverage: 'weak',
      usedRawFallback: true,
    });

    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('cite wiki pages first');
    expect(messages[1].content).toContain('[wiki-page:entity-ada]');
    expect(messages[1].content).toContain('[raw-source:source-1]');
    expect(messages[1].content).toContain('Wiki coverage: weak');
    expect(messages[1].content).toContain('Raw-source fallback used: yes');
  });
});
