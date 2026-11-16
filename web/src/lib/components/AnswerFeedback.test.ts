import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AnswerFeedback from './AnswerFeedback.svelte';

const sources = [
  { id: 'n1', noteId: 'n1', title: 'Payments', relevanceScore: 0.9, kind: 'note' as const },
  { id: 'n2', noteId: 'n2', title: 'Ledger', relevanceScore: 0.5, kind: 'note' as const },
  { id: 'overlay:e1', noteId: 'n1', title: 'edge', relevanceScore: 0.4, kind: 'graph-edge' as const },
  { id: 'wiki-1', noteId: 'wiki-1', title: 'Wiki page', relevanceScore: 0.4, kind: 'wiki-page' as const },
];

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => Response.json({ ok: true }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function sentBody() {
  return JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
}

describe('AnswerFeedback', () => {
  it('thumbs-up credits cited edges and the top note, then thanks the user', async () => {
    render(AnswerFeedback, { query: 'who owns billing?', sources });
    await fireEvent.click(screen.getByRole('button', { name: /answer was helpful/i }));
    expect(fetchMock).toHaveBeenCalledWith('/api/graph/feedback', expect.objectContaining({ method: 'POST' }));
    expect(sentBody()).toEqual({ query: 'who owns billing?', noteId: 'n1', relationIds: ['overlay:e1'], helpful: true });
    expect(screen.getByText(/thanks/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /helpful/i })).toBeNull();
  });

  it('thumbs-down marks the cited edges as unhelpful', async () => {
    render(AnswerFeedback, { query: 'who owns billing?', sources });
    await fireEvent.click(screen.getByRole('button', { name: /answer was not helpful/i }));
    expect(sentBody()).toEqual({ query: 'who owns billing?', relationIds: ['overlay:e1'], helpful: false });
  });

  it('does not call the graph for answers that cite nothing from notes or the graph', async () => {
    render(AnswerFeedback, { query: 'q', sources: [sources[3]] });
    expect(screen.queryByRole('button', { name: /helpful/i })).toBeNull();
  });
});
