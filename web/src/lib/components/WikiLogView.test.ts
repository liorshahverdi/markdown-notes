import { cleanup } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('WikiLogView', () => {
  beforeEach(() => {
    cleanup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ markdown: '# Wiki Log\n\n- 2026-06-01T12:00:00.000Z ingest source-1 page-1' }),
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('loads and renders wiki log markdown', async () => {
    const { render, waitFor } = await import('@testing-library/svelte');
    const { default: WikiLogView } = await import('./WikiLogView.svelte');
    const { getByTestId } = render(WikiLogView);

    await waitFor(() => expect(getByTestId('wiki-log-view').textContent).toContain('source-1'));
    expect(fetch).toHaveBeenCalledWith('/api/wiki/log');
  });
});
