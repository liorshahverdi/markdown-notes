import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ImprovementFeed from './ImprovementFeed.svelte';
import type { GraphProposal } from '../graph/proposals';

afterEach(() => cleanup());

const merge: GraphProposal = {
  id: 'm1', dedupeKey: 'k', kind: 'merge', source: 'duplicate', status: 'pending', confidence: 0.83, createdAt: 1,
  description: 'Merge "Postgres DB" into "Postgres-DB" (Other) — edit-distance similarity 92%',
  payload: { keepKey: 'a', removeKey: 'b', keepName: 'Postgres-DB', removeName: 'Postgres DB', entityType: 'Other' },
  context: {
    merge: {
      keep: { name: 'Postgres-DB', noteCount: 5, notes: [{ id: 'n2', title: 'Infra' }, { id: 'n3', title: 'Ops' }, { id: 'n4', title: 'Runbook' }] },
      remove: { name: 'Postgres DB', noteCount: 1, notes: [{ id: 'n1', title: 'Work Tasks' }] },
    },
  },
};

describe('ImprovementFeed merge cards', () => {
  it('asks whether two names are the same thing and shows where each comes from', () => {
    render(ImprovementFeed, { improvements: [merge] });
    const card = screen.getByRole('group', { name: /same thing\?/i });
    expect(within(card).getByText('“Postgres DB”')).toBeInTheDocument();
    expect(within(card).getByText('in Work Tasks')).toBeInTheDocument();
    expect(within(card).getByText('“Postgres-DB”')).toBeInTheDocument();
    expect(within(card).getByText('in Infra, Ops, Runbook +2 more')).toBeInTheDocument();
    expect(within(card).queryByText(/edit-distance/)).toBeNull();
  });

  it('answers with "Same thing" (approve) or "Different things" (reject)', async () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    render(ImprovementFeed, { improvements: [merge], onAccept, onReject });
    const same = screen.getByRole('button', { name: 'Same thing' });
    expect(same).toHaveAttribute('title', expect.stringMatching(/combine.*one.*undo/i));
    await fireEvent.click(same);
    expect(onAccept).toHaveBeenCalledWith(merge);
    await fireEvent.click(screen.getByRole('button', { name: 'Different things' }));
    expect(onReject).toHaveBeenCalledWith(merge);
  });

  it('offers to undo an applied merge', async () => {
    const onUndo = vi.fn();
    render(ImprovementFeed, { improvements: [{ ...merge, status: 'applied', decidedBy: 'user', reviewOutcome: 'accepted' }], onUndo });
    await fireEvent.click(screen.getByRole('tab', { name: /applied/i }));
    await fireEvent.click(screen.getByRole('button', { name: 'Undo merge' }));
    expect(onUndo).toHaveBeenCalled();
  });

  it('keeps Approve/Reject wording for other proposals', () => {
    const relation: GraphProposal = { ...merge, id: 'r1', kind: 'relation', context: undefined, description: 'Link A ↔ B',
      payload: { fromKey: 'a', toKey: 'b', fromName: 'A', toName: 'B', type: 'related_to', provenance: [] } };
    render(ImprovementFeed, { improvements: [relation] });
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });
});
