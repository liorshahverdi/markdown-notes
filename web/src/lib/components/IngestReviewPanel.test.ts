import { cleanup } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('IngestReviewPanel', () => {
  beforeEach(() => {
    cleanup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        mutation: {
          triggerType: 'ingest',
          notes: 'Imported Computing History',
          sourceIds: ['source-1'],
          changedPageIds: ['source-summary-1', 'entity-ada-lovelace', 'wiki-index'],
          createdPageIds: ['source-summary-1', 'entity-ada-lovelace'],
        },
      }),
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('loads and renders the latest ingest mutation summary', async () => {
    const { render, waitFor } = await import('@testing-library/svelte');
    const { default: IngestReviewPanel } = await import('./IngestReviewPanel.svelte');
    const { getByTestId } = render(IngestReviewPanel);

    await waitFor(() => expect(getByTestId('ingest-review-panel').textContent).toContain('Imported Computing History'));
    expect(getByTestId('ingest-review-panel').textContent).toContain('entity-ada-lovelace');
    expect(fetch).toHaveBeenCalledWith('/api/wiki/mutations/latest');
  });
});
