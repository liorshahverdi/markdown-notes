import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CitationChip from './CitationChip.svelte';

afterEach(() => cleanup());

const edgeSource = {
  id: 'overlay:r1',
  noteId: 'p1',
  title: 'Billing depends_on Ledger',
  relevanceScore: 0.8,
  kind: 'graph-edge' as const,
  excerpt: 'Billing service depends on the Ledger',
  edge: { id: 'overlay:r1', fromEntityId: 'a', toEntityId: 'b', type: 'depends_on', fromName: 'Billing', toName: 'Ledger', reviewState: 'auto' },
};

describe('CitationChip', () => {
  it('renders a graph edge as a readable path with an unreviewed badge and its quote', () => {
    render(CitationChip, { source: edgeSource });
    const chip = screen.getByRole('button', { name: /billing → depends on → ledger/i });
    expect(chip).toHaveTextContent('unreviewed');
    expect(chip).toHaveAttribute('title', expect.stringContaining('“Billing service depends on the Ledger”'));
  });

  it('omits the badge for explicit or accepted edges', () => {
    render(CitationChip, { source: { ...edgeSource, edge: { ...edgeSource.edge, reviewState: 'accepted' } } });
    expect(screen.getByRole('button')).not.toHaveTextContent('unreviewed');
  });

  it('falls back to the title for edges without names and for notes', () => {
    render(CitationChip, { source: { id: 'n1', noteId: 'n1', title: 'Payments', relevanceScore: 0.5, kind: 'note' as const } });
    expect(screen.getByRole('button', { name: /note payments/i })).toHaveAttribute('title', 'Relevance: 50%');
  });

  it('opens the cited note', async () => {
    const onOpen = vi.fn();
    render(CitationChip, { source: edgeSource, onOpen });
    await fireEvent.click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalledWith(edgeSource);
  });
});
