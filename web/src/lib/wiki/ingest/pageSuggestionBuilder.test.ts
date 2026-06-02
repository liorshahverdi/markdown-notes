import { describe, expect, it } from 'vitest';
import { buildPageSuggestions } from './pageSuggestionBuilder';
import type { GraphEntity, GraphRelation } from '../../../types/graph';

describe('buildPageSuggestions', () => {
  it('adapts graph entities into deterministic entity and concept page suggestions', () => {
    const entities: GraphEntity[] = [
      { id: 'note-1', name: 'Source Note', type: 'note', sourceNoteIds: ['note-1'] },
      { id: 'entity-2', name: 'Analytical Engine', type: 'Object', sourceNoteIds: ['source-1'], confidence: 0.9 },
      { id: 'entity-1', name: 'Ada Lovelace', type: 'Person', sourceNoteIds: ['source-1'], confidence: 0.95 },
      { id: 'concept-1', name: 'symbolic programming', type: 'Other', subtype: 'concept', sourceNoteIds: ['source-1'] },
    ];
    const relations: GraphRelation[] = [
      { id: 'rel-1', fromEntityId: 'entity-1', toEntityId: 'entity-2', type: 'created', weight: 0.8 },
    ];

    const suggestions = buildPageSuggestions({
      sourceId: 'source-1',
      sourceTitle: 'Computing Notes',
      sourceText: 'Ada Lovelace wrote about the Analytical Engine and symbolic programming.',
      graph: { entities, relations },
    });

    expect(suggestions.map((suggestion) => [suggestion.pageType, suggestion.title])).toEqual([
      ['entity', 'Ada Lovelace'],
      ['entity', 'Analytical Engine'],
      ['concept', 'symbolic programming'],
    ]);
    expect(suggestions[0].entityKeys).toEqual(['person:ada-lovelace']);
    expect(suggestions[0].relatedEntityKeys).toContain('object:analytical-engine');
  });

  it('falls back to extracting repeated capitalized phrases when no graph output is provided', () => {
    const suggestions = buildPageSuggestions({
      sourceId: 'source-1',
      sourceTitle: 'Computing Notes',
      sourceText: 'Ada Lovelace studied the Analytical Engine. Ada Lovelace wrote notes on the Analytical Engine.',
    });

    expect(suggestions.map((suggestion) => suggestion.title)).toEqual(['Ada Lovelace', 'Analytical Engine']);
  });
});
