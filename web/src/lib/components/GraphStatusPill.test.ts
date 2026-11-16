import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GraphStatusPill from './GraphStatusPill.svelte';
import type { GraphLoopStatus } from '../graph/proposals';

afterEach(() => cleanup());

const base: GraphLoopStatus = { pendingReview: 0, queuedNotes: 0, running: false, lastRun: null, modelSkipped: false };

describe('GraphStatusPill', () => {
  it('links to the review queue with the number of items waiting', () => {
    render(GraphStatusPill, { status: { ...base, pendingReview: 14, queuedNotes: 42 } });
    const link = screen.getByRole('link', { name: /14 to review/i });
    expect(link).toHaveAttribute('href', '/experimental/knowledge-graph');
    // Compact in the header; the full wording lives in the tooltip.
    expect(screen.getByText('· 42 queued')).toBeInTheDocument();
    expect(link).toHaveAttribute('title', expect.stringContaining('42 notes waiting for model analysis'));
  });

  it('says the graph is up to date when nothing is waiting', () => {
    render(GraphStatusPill, { status: base });
    expect(screen.getByRole('link', { name: /graph · up to date/i })).toBeInTheDocument();
  });

  it('shows that a pass is running', () => {
    render(GraphStatusPill, { status: { ...base, running: true, pendingReview: 3 } });
    expect(screen.getByRole('link', { name: /analyzing/i })).toHaveAttribute('aria-busy', 'true');
  });

  it('offers to start Laguna when the last pass skipped the model', async () => {
    const onStartModel = vi.fn();
    render(GraphStatusPill, { status: { ...base, queuedNotes: 5, modelSkipped: true }, onStartModel });
    const start = screen.getByRole('button', { name: /start laguna to analyze 5 notes/i });
    expect(start).toHaveTextContent(/^Start$/);
    await fireEvent.click(start);
    expect(onStartModel).toHaveBeenCalledOnce();
  });

  it('hides the start button while the model is starting', () => {
    render(GraphStatusPill, { status: { ...base, queuedNotes: 5, modelSkipped: true }, modelStarting: true, onStartModel: vi.fn() });
    expect(screen.queryByRole('button', { name: /start laguna/i })).toBeNull();
  });

  it('renders nothing before the first status arrives', () => {
    const { container } = render(GraphStatusPill, { status: null });
    expect(container.textContent?.trim()).toBe('');
  });
});
