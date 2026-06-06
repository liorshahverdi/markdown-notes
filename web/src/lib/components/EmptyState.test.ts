import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import EmptyState from './EmptyState.svelte';

describe('EmptyState wiki and markdown-vault copy', () => {
  afterEach(() => cleanup());

  it('teaches source ingestion, generated wiki pages, markdown files, folders, and wiki health as one workflow', () => {
    const { getAllByText, getByRole, getByText } = render(EmptyState);

    expect(getByRole('heading', { name: /Build your local markdown wiki/i })).toBeTruthy();
    expect(getAllByText(/Import sources/i).length).toBeGreaterThan(0);
    expect(getByText(/generated wiki pages/i)).toBeTruthy();
    expect(getAllByText(/wiki health/i).length).toBeGreaterThan(0);
    expect(getAllByText(/markdown vault/i).length).toBeGreaterThan(0);
    expect(getAllByText(/folders/i).length).toBeGreaterThan(0);
  });

  it('does not foreground legacy note-editor or note-graph language', () => {
    const { container } = render(EmptyState);
    const text = container.textContent ?? '';

    expect(text).not.toContain('A blank page awaits.');
    expect(text).not.toContain('Select a note from your library');
    expect(text).not.toContain('Each note becomes a node in your knowledge graph');
    expect(text).not.toContain('New note');
    expect(text).not.toContain('Dictate');
    expect(text).not.toContain('legacy notes');
  });
});
