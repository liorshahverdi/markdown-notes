import { describe, expect, it } from 'vitest';
import { presentProposal } from './proposalPresenter';
import type { GraphProposal } from './proposals';

const base = { id: 'p', dedupeKey: 'k', status: 'pending' as const, confidence: 0.9, description: 'd', createdAt: 1 };

describe('presentProposal', () => {
  it('shows a missed entity by name and type', () => {
    const p: GraphProposal = { ...base, kind: 'new_entity', source: 'llm_missed', noteId: 'n1',
      payload: { entityKey: 'person:dave', name: 'Dave', type: 'Person', noteId: 'n1' } };
    expect(presentProposal(p, 'n1')).toEqual({ label: 'Dave', detail: 'Person', quote: 'Dave' });
  });

  it('shows a relation as a readable path with the quote from this note', () => {
    const p: GraphProposal = { ...base, kind: 'relation', source: 'llm_implicit', payload: {
      fromKey: 'a', toKey: 'b', fromName: 'Billing', toName: 'Ledger', type: 'depends_on',
      provenance: [{ noteId: 'other', excerpt: 'elsewhere', method: 'llm' }, { noteId: 'n1', excerpt: 'Billing depends on the Ledger', method: 'llm' }],
    } };
    expect(presentProposal(p, 'n1')).toEqual({ label: 'Billing → depends on → Ledger', detail: 'link', quote: 'Billing depends on the Ledger' });
  });

  it('describes co-occurrence links without a quote', () => {
    const p: GraphProposal = { ...base, kind: 'relation', source: 'cooccurrence', payload: {
      fromKey: 'a', toKey: 'b', fromName: 'kafka', toName: 'zookeeper', type: 'related_to',
      provenance: [{ noteId: 'n1', method: 'cooccurrence' }],
    } };
    expect(presentProposal(p, 'n1')).toEqual({ label: 'kafka ↔ zookeeper', detail: 'often together', quote: null });
  });

  it('describes merges and type corrections', () => {
    const merge: GraphProposal = { ...base, kind: 'merge', source: 'duplicate',
      payload: { keepKey: 'a', removeKey: 'b', keepName: 'ReactJS', removeName: 'React.js', entityType: 'Object' } };
    const retype: GraphProposal = { ...base, kind: 'type_correction', source: 'llm_validation',
      payload: { entityKey: 'x', name: 'Standup', oldType: 'Other', newType: 'Event' } };
    expect(presentProposal(merge, 'n1')).toEqual({ label: 'React.js = ReactJS', detail: 'same thing', quote: null });
    expect(presentProposal(retype, 'n1')).toEqual({ label: 'Standup', detail: 'Other → Event', quote: 'Standup' });
  });
});
