import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import EmptyState from './EmptyState.svelte';

describe('EmptyState note-first copy', () => {
  afterEach(() => cleanup());

  it('teaches notes, diagrams, graph memory, chat recall, and agent skills as one workflow', () => {
    const { getAllByText, getByRole, getByText } = render(EmptyState);

    expect(getByRole('heading', { name: /Write markdown notes and diagrams/i })).toBeTruthy();
    expect(getAllByText(/Create a note/i).length).toBeGreaterThan(0);
    expect(getAllByText(/knowledge graph/i).length).toBeGreaterThan(0);
    expect(getAllByText(/chat memory/i).length).toBeGreaterThan(0);
    expect(getAllByText(/agent skills/i).length).toBeGreaterThan(0);
    expect(getByText(/local-first notes/i)).toBeTruthy();
  });

  it('does not foreground generated wiki or legacy note-editor language', () => {
    const { container } = render(EmptyState);
    const text = container.textContent ?? '';

    expect(text).not.toContain('Build your local markdown wiki');
    expect(text).not.toContain('Import sources');
    expect(text).not.toContain('generated wiki pages');
    expect(text).not.toContain('wiki health');
    expect(text).not.toContain('legacy notes');
  });
});
