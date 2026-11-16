import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NoteSuggestions from './NoteSuggestions.svelte';
import type { GraphProposal } from '../graph/proposals';

const base = { dedupeKey: 'k', status: 'pending' as const, confidence: 0.9, description: 'd', createdAt: 1 };
const proposals: GraphProposal[] = [
  { ...base, id: 'p-dave', kind: 'new_entity', source: 'llm_missed', noteId: 'n1',
    payload: { entityKey: 'person:dave', name: 'Dave', type: 'Person', noteId: 'n1' } },
  { ...base, id: 'p-link', kind: 'relation', source: 'llm_implicit', noteId: 'n1', payload: {
    fromKey: 'a', toKey: 'b', fromName: 'Billing', toName: 'Ledger', type: 'depends_on',
    provenance: [{ noteId: 'n1', excerpt: 'Billing depends on the Ledger', method: 'llm' }] } },
];

let calls: Array<{ url: string; body?: unknown }>;
let serverProposals: GraphProposal[];

beforeEach(() => {
  calls = [];
  serverProposals = [...proposals];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.startsWith('/api/graph/proposals?')) return Response.json({ proposals: serverProposals });
    if (url.startsWith('/api/graph/proposals/')) return Response.json({ ok: true, proposal: {} });
    if (url === '/api/graph/status') return Response.json({ pendingReview: 1, queuedNotes: 0, running: false, lastRun: null, modelSkipped: false });
    return Response.json({});
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('NoteSuggestions', () => {
  it("lists this note's pending suggestions", async () => {
    render(NoteSuggestions, { noteId: 'n1' });
    expect(await screen.findByText(/2 suggestions for this note/i)).toBeInTheDocument();
    expect(calls[0].url).toBe('/api/graph/proposals?noteId=n1&status=pending');
    expect(screen.getByText('Dave')).toBeInTheDocument();
    expect(screen.getByText('Billing → depends on → Ledger')).toBeInTheDocument();
  });

  it('approves and rejects in place', async () => {
    render(NoteSuggestions, { noteId: 'n1' });
    await fireEvent.click(await screen.findByRole('button', { name: /approve dave/i }));
    expect(calls.find((c) => c.url === '/api/graph/proposals/p-dave')?.body).toEqual({ action: 'accept' });
    await waitFor(() => expect(screen.queryByText('Dave')).toBeNull());
    expect(calls.some((c) => c.url === '/api/graph/status')).toBe(true);

    await fireEvent.click(screen.getByRole('button', { name: /reject billing → depends on → ledger/i }));
    expect(calls.find((c) => c.url === '/api/graph/proposals/p-link')?.body).toEqual({ action: 'reject' });
    await waitFor(() => expect(screen.queryByText(/suggestions? for this note/i)).toBeNull());
  });

  it('highlights the evidence while a suggestion is hovered or focused', async () => {
    const onHighlight = vi.fn();
    render(NoteSuggestions, { noteId: 'n1', onHighlight });
    const item = (await screen.findByText('Billing → depends on → Ledger')).closest('li')!;
    await fireEvent.mouseEnter(item);
    expect(onHighlight).toHaveBeenLastCalledWith('Billing depends on the Ledger');
    await fireEvent.mouseLeave(item);
    expect(onHighlight).toHaveBeenLastCalledWith(null);
    await fireEvent.focusIn(item);
    expect(onHighlight).toHaveBeenLastCalledWith('Billing depends on the Ledger');
  });

  it('renders nothing when the note has no suggestions', async () => {
    serverProposals = [];
    const { container } = render(NoteSuggestions, { noteId: 'n1' });
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(container.textContent?.trim()).toBe('');
  });

  it('reloads when another pass finishes', async () => {
    const view = render(NoteSuggestions, { noteId: 'n1', refreshKey: 'run-1' });
    await screen.findByText('Dave');
    await view.rerender({ noteId: 'n1', refreshKey: 'run-2' });
    await waitFor(() => expect(calls.filter((c) => c.url.startsWith('/api/graph/proposals?'))).toHaveLength(2));
  });
});
