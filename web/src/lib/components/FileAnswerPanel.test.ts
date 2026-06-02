import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FileAnswerPanel from './FileAnswerPanel.svelte';

describe('FileAnswerPanel', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  afterEach(() => cleanup());

  it('posts the answer for filing and shows the created wiki page', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'filed', pageId: 'question-ada', wikiPath: 'wiki/questions/ada.md' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { getByRole, getByText } = render(FileAnswerPanel, {
      props: {
        question: 'What did Ada contribute?',
        answer: 'Ada described symbolic operations.',
        citations: [{ id: 'entity-ada', title: 'Ada Lovelace', kind: 'wiki-page', wikiPath: 'wiki/entities/ada-lovelace.md', relevanceScore: 1 }],
        coverage: 'strong',
        usedRawFallback: false,
      },
    });

    await fireEvent.click(getByRole('button', { name: 'File answer to wiki' }));

    expect(fetchMock).toHaveBeenCalledWith('/api/wiki/file-answer', expect.objectContaining({ method: 'POST' }));
    await waitFor(() => expect(getByText('Filed to wiki/questions/ada.md')).toBeTruthy());
  });
});
