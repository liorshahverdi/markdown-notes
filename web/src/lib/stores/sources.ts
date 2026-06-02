import { writable } from 'svelte/store';

export interface SourceListItem {
  id: string;
  title: string;
  slug: string;
  sourceType: string;
  rawPath: string;
  importedAt: number;
  status: string;
}

export interface SourceImportDraft {
  title: string;
  content: string;
  sourceType: string;
}

export function importSourceDraft(): SourceImportDraft {
  return {
    title: '',
    content: '',
    sourceType: 'manual',
  };
}

export const sources = writable<SourceListItem[]>([]);
export const sourcesLoading = writable(false);
export const sourcesError = writable<string | null>(null);
export const sourceImportDraft = writable<SourceImportDraft>(importSourceDraft());

export async function loadSources(): Promise<void> {
  sourcesLoading.set(true);
  sourcesError.set(null);

  try {
    const response = await fetch('/api/sources');
    if (!response.ok) {
      throw new Error(`Failed to load sources (${response.status})`);
    }

    const data = (await response.json()) as { sources?: SourceListItem[] };
    sources.set(data.sources ?? []);
  } catch (error) {
    sourcesError.set(error instanceof Error ? error.message : 'Failed to load sources');
  } finally {
    sourcesLoading.set(false);
  }
}

export async function importSource(): Promise<void> {
  sourcesError.set(null);

  let draft = importSourceDraft();
  sourceImportDraft.update((value) => {
    draft = value;
    return value;
  });

  const response = await fetch('/api/sources/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  });

  if (!response.ok) {
    sourcesError.set(`Failed to import source (${response.status})`);
    return;
  }

  const data = (await response.json()) as { source: SourceListItem };
  sources.update((current) => [data.source, ...current]);
  sourceImportDraft.set(importSourceDraft());
}

export function resetSourcesForTests(): void {
  sources.set([]);
  sourcesLoading.set(false);
  sourcesError.set(null);
  sourceImportDraft.set(importSourceDraft());
}
