import { describe, expect, it } from 'vitest';
import { acceptGraphEdge, getInferredEdgeReviewQueue, rejectGraphEdge } from './edgeReview';
import type { GraphRelation } from '../../types/graph';

const edges: GraphRelation[] = [
  {
    id: 'llm-low',
    fromEntityId: 'a',
    toEntityId: 'b',
    type: 'inferred_by_model',
    confidence: 0.42,
    accepted: false,
    provenance: [{ noteId: 'n1', method: 'llm', excerpt: 'Maybe A relates to B' }],
  },
  {
    id: 'regex-high',
    fromEntityId: 'a',
    toEntityId: 'c',
    type: 'mentions',
    confidence: 0.9,
    accepted: true,
    provenance: [{ noteId: 'n1', method: 'regex' }],
  },
];

describe('edge review helpers', () => {
  it('queues only unaccepted model-inferred or low-confidence edges', () => {
    expect(getInferredEdgeReviewQueue(edges).map((edge) => edge.id)).toEqual(['llm-low']);
  });

  it('accepts or rejects edges without mutating the original array', () => {
    const accepted = acceptGraphEdge(edges, 'llm-low');
    expect(accepted.find((edge) => edge.id === 'llm-low')).toMatchObject({ accepted: true, rejected: false });
    expect(edges.find((edge) => edge.id === 'llm-low')?.accepted).toBe(false);

    const rejected = rejectGraphEdge(edges, 'llm-low');
    expect(rejected.find((edge) => edge.id === 'llm-low')).toMatchObject({ accepted: false, rejected: true });
  });
});
