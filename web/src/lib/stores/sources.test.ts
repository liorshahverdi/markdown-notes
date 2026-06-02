import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  importSource,
  importSourceDraft,
  loadSources,
  resetSourcesForTests,
  sourceImportDraft,
  sources,
  sourcesError,
  sourcesLoading,
} from './sources';

describe('sources store', () => {
  beforeEach(() => {
    resetSourcesForTests();
    vi.restoreAllMocks();
  });

  it('loads sources from the API and clears prior errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          sources: [
            {
              id: 'source-1',
              title: 'LLM Wiki Notes',
              slug: 'llm-wiki-notes',
              sourceType: 'note',
              rawPath: 'raw/2026/llm-wiki-notes.md',
              importedAt: 123,
              status: 'queued',
            },
          ],
        }),
      })
    );

    await loadSources();

    expect(get(sourcesLoading)).toBe(false);
    expect(get(sourcesError)).toBeNull();
    expect(get(sources)).toHaveLength(1);
    expect(get(sources)[0].title).toBe('LLM Wiki Notes');
  });

  it('submits the draft to the import API and prepends the created source', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          source: {
            id: 'source-2',
            title: 'Scratch capture',
            slug: 'scratch-capture',
            sourceType: 'manual',
            rawPath: 'raw/2026/scratch-capture.md',
            importedAt: 456,
            status: 'queued',
          },
        }),
      })
    );

    sourceImportDraft.set({
      title: 'Scratch capture',
      content: 'plain text content',
      sourceType: 'manual',
    });

    await importSource();

    expect(fetch).toHaveBeenCalledWith(
      '/api/sources/import',
      expect.objectContaining({ method: 'POST' })
    );
    expect(get(sources)).toHaveLength(1);
    expect(get(sources)[0].id).toBe('source-2');
    expect(get(sourceImportDraft)).toEqual(importSourceDraft());
    expect(get(sourcesError)).toBeNull();
  });
});
