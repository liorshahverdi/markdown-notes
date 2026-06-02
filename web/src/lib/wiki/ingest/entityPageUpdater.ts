import { upsertSuggestedPages, type UpsertSuggestedPagesInput, type UpsertSuggestedPagesResult } from './suggestedPageUpdater';

export function upsertEntityPages(input: UpsertSuggestedPagesInput): UpsertSuggestedPagesResult {
  return upsertSuggestedPages(input, 'entity');
}
