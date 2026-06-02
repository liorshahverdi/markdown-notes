import { cleanup } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSources = writable([
  {
    id: 'source-1',
    title: 'LLM Wiki Notes',
    slug: 'llm-wiki-notes',
    sourceType: 'note',
    rawPath: 'raw/2026/llm-wiki-notes.md',
    importedAt: 1717286400000,
    status: 'queued',
  },
]);
const mockLoading = writable(false);
const mockError = writable<string | null>(null);
const mockDraft = writable({
  title: '',
  content: '',
  sourceType: 'manual',
});
const loadSources = vi.fn();
const importSource = vi.fn();

vi.mock('$lib/stores/sources', () => ({
  sources: mockSources,
  sourcesLoading: mockLoading,
  sourcesError: mockError,
  sourceImportDraft: mockDraft,
  loadSources,
  importSource,
}));

describe('SourcesPane', () => {
  beforeEach(() => {
    cleanup();
    mockSources.set([
      {
        id: 'source-1',
        title: 'LLM Wiki Notes',
        slug: 'llm-wiki-notes',
        sourceType: 'note',
        rawPath: 'raw/2026/llm-wiki-notes.md',
        importedAt: 1717286400000,
        status: 'queued',
      },
    ]);
    mockLoading.set(false);
    mockError.set(null);
    mockDraft.set({ title: '', content: '', sourceType: 'manual' });
    loadSources.mockReset();
    importSource.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders imported sources with metadata', async () => {
    const { render } = await import('@testing-library/svelte');
    const { default: SourcesPane } = await import('./SourcesPane.svelte');

    const { getByTestId } = render(SourcesPane);

    expect(getByTestId('sources-pane')).toBeTruthy();
    expect(getByTestId('source-item-source-1').textContent).toContain('LLM Wiki Notes');
    expect(getByTestId('source-item-source-1').textContent).toContain('note');
  });

  it('submits a new source import from the form', async () => {
    const { fireEvent, render } = await import('@testing-library/svelte');
    const { default: SourcesPane } = await import('./SourcesPane.svelte');

    const { getByTestId } = render(SourcesPane);

    await fireEvent.input(getByTestId('source-title-input'), {
      target: { value: 'New source' },
    });
    await fireEvent.input(getByTestId('source-content-input'), {
      target: { value: 'Some imported text' },
    });
    await fireEvent.click(getByTestId('source-import-submit'));

    expect(importSource).toHaveBeenCalledTimes(1);
  });
});
