import { describe, expect, it } from 'vitest';
import { buildGraphRelationReviewKey } from './relationReviewKey';

describe('buildGraphRelationReviewKey', () => {
  it('builds a stable directed key from endpoint names and relation type', () => {
    expect(buildGraphRelationReviewKey({ fromName: ' Alpha  Project ', toName: 'Beta\nSystem', type: 'depends_on' }))
      .toBe('depends_on:alpha project->beta system');
  });
});
