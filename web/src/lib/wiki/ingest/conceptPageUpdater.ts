import { upsertSuggestedPages, type UpsertSuggestedPagesInput, type UpsertSuggestedPagesResult } from './suggestedPageUpdater';

export function upsertConceptPages(input: UpsertSuggestedPagesInput): UpsertSuggestedPagesResult {
  return upsertSuggestedPages(input, 'concept');
}
