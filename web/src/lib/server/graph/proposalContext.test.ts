import { describe, expect, it } from 'vitest';
import type { GraphProposal } from '../../graph/proposals';
import type { NoteRecord } from '../../../types/note';
import { attachProposalContext } from './graphService';
import { materializeGraph } from './materialize';

const note = (id: string, title: string, content: string): NoteRecord => ({ id, title, content, dateModified: 1, isPinned: false });

describe('attachProposalContext', () => {
  it('lists the notes each name in a merge comes from', () => {
    const notes = [
      note('n1', 'Work Tasks', '# Work Tasks\n\n## Postgres DB\n'),
      note('n2', 'Infra', '# Infra\n\n## Postgres-DB\n'),
      note('n3', 'Ops', '# Ops\n\n## Postgres-DB\n'),
    ];
    const graph = materializeGraph({ notes, folders: [] });
    const merge: GraphProposal = {
      id: 'm', dedupeKey: 'k', kind: 'merge', source: 'duplicate', status: 'pending', confidence: 0.9, description: 'd', createdAt: 1,
      payload: { keepKey: 'other:topic:postgres-db', removeKey: 'other:topic:postgres db', keepName: 'Postgres-DB', removeName: 'Postgres DB', entityType: 'Other' },
    };
    const [withContext] = attachProposalContext([merge], graph, notes);
    expect(withContext.context).toEqual({
      merge: {
        keep: { name: 'Postgres-DB', noteCount: 2, notes: [{ id: 'n2', title: 'Infra' }, { id: 'n3', title: 'Ops' }] },
        remove: { name: 'Postgres DB', noteCount: 1, notes: [{ id: 'n1', title: 'Work Tasks' }] },
      },
    });
  });

  it('leaves other proposals unchanged', () => {
    const relation = { id: 'r', kind: 'relation' } as GraphProposal;
    const graph = materializeGraph({ notes: [], folders: [] });
    expect(attachProposalContext([relation], graph, [])).toEqual([relation]);
  });
});
