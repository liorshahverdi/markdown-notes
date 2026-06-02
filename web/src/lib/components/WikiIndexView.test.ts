import { cleanup } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('WikiIndexView', () => {
  beforeEach(() => {
    cleanup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ markdown: '# Wiki Index\n\n## Source Summaries\n\n- [[sources/llm-wiki-notes|LLM Wiki Notes]]' }),
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('loads and renders wiki index markdown', async () => {
    const { render, waitFor } = await import('@testing-library/svelte');
    const { default: WikiIndexView } = await import('./WikiIndexView.svelte');
    const { getByTestId } = render(WikiIndexView);

    await waitFor(() => expect(getByTestId('wiki-index-view').textContent).toContain('LLM Wiki Notes'));
    expect(fetch).toHaveBeenCalledWith('/api/wiki/index');
  });
});
