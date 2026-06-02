import { describe, expect, it } from 'vitest';
import { classifyAnswerForFiling } from './answerClassifier';

describe('classifyAnswerForFiling', () => {
  it('marks cited substantive answers as useful filing candidates', () => {
    const result = classifyAnswerForFiling({
      question: 'What did Ada contribute?',
      answer: 'Ada Lovelace described how the Analytical Engine could manipulate symbols beyond arithmetic. [wiki-page:entity-ada]',
      citations: [{ id: 'entity-ada', title: 'Ada Lovelace', kind: 'wiki-page', wikiPath: 'wiki/entities/ada-lovelace.md', relevanceScore: 1 }],
      coverage: 'strong',
      usedRawFallback: false,
    });

    expect(result).toMatchObject({ shouldFile: true, targetPageType: 'question', confidence: 'high' });
    expect(result.reasons).toContain('answer has wiki citations');
  });

  it('rejects empty, error, and no-context answers', () => {
    const result = classifyAnswerForFiling({
      question: 'What is missing?',
      answer: 'I do not have enough information to answer that.',
      citations: [],
      coverage: 'weak',
      usedRawFallback: false,
    });

    expect(result.shouldFile).toBe(false);
    expect(result.reasons).toContain('answer says there is insufficient information');
  });
});
