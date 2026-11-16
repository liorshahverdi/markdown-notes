import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeDatabase } from '../database';
import { insertProposal, readProposals } from './graphStore';

const dbs: Database.Database[] = [];
afterEach(() => {
  while (dbs.length) dbs.pop()?.close();
});

describe('readProposals by note', () => {
  it('returns proposals made from a note or citing it as evidence, for that user only', () => {
    const db = new Database(':memory:');
    initializeDatabase(db);
    dbs.push(db);
    const relation = (fromKey: string, toKey: string, noteIds: string[]) => ({
      fromKey, toKey, fromName: fromKey, toName: toKey, type: 'related_to' as const,
      provenance: noteIds.map((noteId) => ({ noteId, method: 'cooccurrence' as const })),
    });
    insertProposal(db, 'u', { dedupeKey: 'a', kind: 'new_entity', source: 'llm_missed', confidence: 0.9, description: 'from n1', noteId: 'n1',
      payload: { entityKey: 'person:dave', name: 'Dave', type: 'Person', noteId: 'n1' } });
    insertProposal(db, 'u', { dedupeKey: 'b', kind: 'relation', source: 'cooccurrence', confidence: 0.7, description: 'cites n1', payload: relation('x', 'y', ['n9', 'n1']) });
    insertProposal(db, 'u', { dedupeKey: 'c', kind: 'relation', source: 'cooccurrence', confidence: 0.7, description: 'cites n10 only', payload: relation('x', 'z', ['n10']) });
    insertProposal(db, 'other', { dedupeKey: 'a', kind: 'new_entity', source: 'llm_missed', confidence: 0.9, description: 'other user', noteId: 'n1',
      payload: { entityKey: 'person:dave', name: 'Dave', type: 'Person', noteId: 'n1' } });

    const found = readProposals(db, 'u', { noteId: 'n1', status: 'pending' }).map((p) => p.description).sort();
    expect(found).toEqual(['cites n1', 'from n1']);
  });
});
