import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeDatabase } from '../database';
import type { NoteRecord } from '../../../types/note';
import { insertProposal, readProposals } from './graphStore';
import { runGraphPass } from './graphWorker';

const dbs: Database.Database[] = [];
afterEach(() => {
  while (dbs.length) dbs.pop()?.close();
});

const note = (id: string, content: string): NoteRecord => ({ id, title: `Note ${id}`, content, dateModified: 1, isPinned: false });

describe('stale proposals', () => {
  it('retires pending proposals whose entities or evidence no longer exist, keeping valid ones', async () => {
    const db = new Database(':memory:');
    initializeDatabase(db);
    dbs.push(db);
    const notes = [note('n1', '# Note n1\n\n## Kafka\n\n## Zookeeper\n\nDave restarted Kafka.')];
    const add = (dedupeKey: string, proposal: Omit<Parameters<typeof insertProposal>[2], 'dedupeKey' | 'confidence' | 'description'>) =>
      insertProposal(db, 'u', { dedupeKey, confidence: 0.8, description: dedupeKey, ...proposal })!;

    const goneMerge = add('gone-merge', { kind: 'merge', source: 'duplicate',
      payload: { keepKey: 'event:ded in the upcoming technical review', removeKey: 'event:ion in the upcoming technical review', keepName: 'a', removeName: 'b', entityType: 'Event' } });
    const liveMerge = add('live-merge', { kind: 'merge', source: 'duplicate',
      payload: { keepKey: 'other:topic:kafka', removeKey: 'other:topic:zookeeper', keepName: 'Kafka', removeName: 'Zookeeper', entityType: 'Other' } });
    const goneEntity = add('gone-entity', { kind: 'new_entity', source: 'llm_missed', noteId: 'n1',
      payload: { entityKey: 'person:bob', name: 'Bob', type: 'Person', noteId: 'n1' } });
    const liveEntity = add('live-entity', { kind: 'new_entity', source: 'llm_missed', noteId: 'n1',
      payload: { entityKey: 'person:dave', name: 'Dave', type: 'Person', noteId: 'n1' } });
    const goneRelation = add('gone-rel', { kind: 'relation', source: 'llm_implicit',
      payload: { fromKey: 'other:topic:kafka', toKey: 'other:topic:missing', fromName: 'Kafka', toName: 'Missing', type: 'depends_on', provenance: [] } });

    const run = await runGraphPass({ db, userId: 'u', notes, folders: [], trigger: 'test', llm: null });

    const status = new Map(readProposals(db, 'u').map((p) => [p.id, p.status]));
    expect(status.get(goneMerge.id)).toBe('obsolete');
    expect(status.get(goneEntity.id)).toBe('obsolete');
    expect(status.get(goneRelation.id)).toBe('obsolete');
    expect(status.get(liveMerge.id)).toBe('pending');
    expect(status.get(liveEntity.id)).toBe('pending');
    expect(run.stats.obsoleteProposals).toBe(3);
  });
});
