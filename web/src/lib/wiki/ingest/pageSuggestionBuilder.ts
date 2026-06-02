import type { GraphEntity, GraphRelation } from '../../../types/graph';
import type { WikiPageType } from '$lib/wiki/types';

export interface PageSuggestion {
  title: string;
  slug: string;
  pageType: Extract<WikiPageType, 'entity' | 'concept'>;
  summary: string;
  entityKeys: string[];
  relatedEntityKeys: string[];
  sourceIds: string[];
}

export interface BuildPageSuggestionsInput {
  sourceId: string;
  sourceTitle: string;
  sourceText: string;
  graph?: {
    entities: GraphEntity[];
    relations: GraphRelation[];
  };
}

const STRUCTURAL_TYPES = new Set(['note', 'folder']);
const CONCEPT_SUBTYPES = new Set(['concept', 'topic']);

export function slugifyWikiValue(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'page';
}

function entityKeyFor(entity: GraphEntity): string {
  const prefix = entity.type === 'Other' && CONCEPT_SUBTYPES.has(entity.subtype ?? '') ? 'concept' : entity.type.toLowerCase();
  return `${prefix}:${slugifyWikiValue(entity.name)}`;
}

function pageTypeFor(entity: GraphEntity): 'entity' | 'concept' {
  return entity.type === 'Other' && CONCEPT_SUBTYPES.has(entity.subtype ?? '') ? 'concept' : 'entity';
}

function summaryFor(title: string, sourceTitle: string): string {
  return `${title} is mentioned in ${sourceTitle}.`;
}

function suggestionSort(a: PageSuggestion, b: PageSuggestion): number {
  const typeRank = (value: PageSuggestion['pageType']) => value === 'entity' ? 0 : 1;
  return typeRank(a.pageType) - typeRank(b.pageType) || a.title.localeCompare(b.title);
}

function suggestionsFromGraph(input: BuildPageSuggestionsInput): PageSuggestion[] {
  if (!input.graph) return [];
  const entities = input.graph.entities.filter((entity) => !STRUCTURAL_TYPES.has(entity.type));
  const entityById = new Map(entities.map((entity) => [entity.id, entity]));

  return entities
    .map((entity) => {
      const key = entityKeyFor(entity);
      const relatedEntityKeys = input.graph!.relations
        .filter((relation) => relation.fromEntityId === entity.id || relation.toEntityId === entity.id)
        .map((relation) => relation.fromEntityId === entity.id ? relation.toEntityId : relation.fromEntityId)
        .map((id) => entityById.get(id))
        .filter((related): related is GraphEntity => Boolean(related))
        .map(entityKeyFor)
        .filter((relatedKey) => relatedKey !== key)
        .sort();

      return {
        title: entity.name,
        slug: slugifyWikiValue(entity.name),
        pageType: pageTypeFor(entity),
        summary: summaryFor(entity.name, input.sourceTitle),
        entityKeys: [key],
        relatedEntityKeys,
        sourceIds: [input.sourceId],
      } satisfies PageSuggestion;
    })
    .sort(suggestionSort);
}

function suggestionsFromText(input: BuildPageSuggestionsInput): PageSuggestion[] {
  const counts = new Map<string, number>();
  const pattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  for (const match of input.sourceText.matchAll(pattern)) {
    const title = match[1].trim();
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([title]) => ({
      title,
      slug: slugifyWikiValue(title),
      pageType: 'entity' as const,
      summary: summaryFor(title, input.sourceTitle),
      entityKeys: [`entity:${slugifyWikiValue(title)}`],
      relatedEntityKeys: [],
      sourceIds: [input.sourceId],
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function buildPageSuggestions(input: BuildPageSuggestionsInput): PageSuggestion[] {
  const suggestions = suggestionsFromGraph(input);
  const fallbackSuggestions = suggestions.length > 0 ? suggestions : suggestionsFromText(input);
  const seen = new Set<string>();
  return fallbackSuggestions.filter((suggestion) => {
    const key = `${suggestion.pageType}:${suggestion.slug}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
