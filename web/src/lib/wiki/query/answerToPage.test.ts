import { describe, expect, it } from 'vitest';
import { draftAnswerPageUpdate } from './answerToPage';

describe('draftAnswerPageUpdate', () => {
  it('creates a deterministic question page draft from an answer and citations', () => {
    const draft = draftAnswerPageUpdate({
      question: 'What did Ada contribute?',
      answer: 'Ada described symbolic operations for the Analytical Engine. [wiki-page:entity-ada]',
      citations: [{ id: 'entity-ada', title: 'Ada Lovelace', kind: 'wiki-page', wikiPath: 'wiki/entities/ada-lovelace.md', relevanceScore: 1 }],
      coverage: 'strong',
      usedRawFallback: false,
    });

    expect(draft.record).toMatchObject({
      id: 'question-what-did-ada-contribute',
      title: 'What did Ada contribute?',
      slug: 'what-did-ada-contribute',
      pageType: 'question',
      wikiPath: 'wiki/questions/what-did-ada-contribute.md',
      lastUpdatedReason: 'query-filed',
    });
    expect(draft.markdown).toContain('# What did Ada contribute?');
    expect(draft.markdown).toContain('## Answer');
    expect(draft.markdown).toContain('Ada described symbolic operations');
    expect(draft.markdown).toContain('[[entities/ada-lovelace|Ada Lovelace]]');
    expect(draft.markdown).toContain('Wiki coverage: strong');
  });
});
