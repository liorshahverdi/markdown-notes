import { describe, expect, it } from 'vitest';
import { buildGraphRelationReviewKey } from '$lib/graph/relationReviewKey';
import { retrieveGraphMemory } from './graphMemoryRetriever';
import type { NoteRecord } from '../../types/note';

const notes: NoteRecord[] = [
  {
    id: 'n1',
    title: 'Diagram Note',
    content: `# Diagram Note

The Alpha Project depends on the Beta System.

\`\`\`mermaid
graph TD
  AlphaProject --> BetaSystem
\`\`\`
`,
    dateModified: 1,
    isPinned: false,
  },
];

describe('retrieveGraphMemory relation reviews', () => {
  it('excludes graph evidence for edges rejected by user review state', () => {
    const unreviewed = retrieveGraphMemory({ notes, folders: [], query: 'AlphaProject BetaSystem', limit: 5 });
    const edge = unreviewed.find((item) => item.from.name === 'AlphaProject' && item.to.name === 'BetaSystem');
    expect(edge).toBeTruthy();

    const rejectedReviewKey = buildGraphRelationReviewKey({
      fromName: 'AlphaProject',
      toName: 'BetaSystem',
      type: 'depends_on',
    });

    const reviewed = retrieveGraphMemory({
      notes,
      folders: [],
      query: 'AlphaProject BetaSystem',
      limit: 5,
      relationReviews: new Map([[rejectedReviewKey, { reviewKey: rejectedReviewKey, rejected: true, accepted: false }]]),
    });

    expect(reviewed.some((item) => item.from.name === 'AlphaProject' && item.to.name === 'BetaSystem')).toBe(false);
  });
});
