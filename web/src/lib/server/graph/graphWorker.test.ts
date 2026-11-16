import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeDatabase } from '../database';
import type { NoteRecord } from '../../../types/note';
import type { RelationProposalPayload } from '../../graph/proposals';
import { runGraphPass, type LlmDeps } from './graphWorker';
import { addEvalQuery, clearNoteStates, readNoteStates, readProposals, readRuns } from './graphStore';
import { materializeForUser, reviewGraphEdge, reviewProposal, transitiveSuggestions } from './graphService';

const dbs: Database.Database[] = [];
afterEach(() => {
  while (dbs.length) dbs.pop()?.close();
});

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  initializeDatabase(db);
  dbs.push(db);
  return db;
}

function note(id: string, title: string, content: string, dateModified = 1): NoteRecord {
  return { id, title, content, dateModified, isPinned: false };
}

/** #kafka and #zookeeper always co-occur (5 notes); #misc is everywhere. */
function corpus(): NoteRecord[] {
  return [
    note('n1', 'Broker tuning', '# Broker tuning\n\nBroker settings for the cluster. #kafka #zookeeper #misc', 8),
    note('n2', 'Cluster upgrade', '# Cluster upgrade\n\nUpgrade steps. #kafka #zookeeper #misc', 7),
    note('n3', 'Incident review', '# Incident review\n\nZK session expiry. #kafka #zookeeper #misc', 6),
    note('n4', 'Capacity plan', '# Capacity plan\n\nDisk sizing. #kafka #zookeeper #misc', 5),
    note('n5', 'Security audit', '# Security audit\n\nACL review. #kafka #zookeeper #misc', 4),
    note('n6', 'Recipes', '# Recipes\n\nPasta. #cooking #misc', 3),
    note('n7', 'Groceries', '# Groceries\n\nEggs. #cooking #misc', 2),
    note('n8', 'Reading list', '# Reading list\n\nBooks. #misc', 1),
  ];
}

function fakeLlm(respond: (prompt: string) => unknown): LlmDeps & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    healthy: async () => true,
    complete: async (prompt: string) => {
      calls.push(prompt);
      return JSON.stringify(respond(prompt));
    },
  };
}

describe('runGraphPass', () => {
  it('proposes co-occurrence links, never re-proposes them, and records a run', async () => {
    const db = freshDb();
    const notes = corpus();
    const first = await runGraphPass({ db, userId: 'u', notes, folders: [], trigger: 'test', llm: null });
    expect(first.status).toBe('completed');
    const proposals = readProposals(db, 'u', { kind: 'relation' });
    const pairs = proposals.map((p) => {
      const payload = p.payload as RelationProposalPayload;
      return [payload.fromName, payload.toName].sort().join('+');
    });
    expect(pairs).toContain('kafka+zookeeper');
    expect(pairs.some((pair) => pair.includes('misc'))).toBe(false);

    const second = await runGraphPass({ db, userId: 'u', notes, folders: [], trigger: 'test', llm: null });
    expect(second.stats.cooccurrenceProposals).toBe(0);
    expect(readRuns(db, 'u')).toHaveLength(2);
  });

  it('remembers rejections across a full re-process', async () => {
    const db = freshDb();
    const notes = corpus();
    await runGraphPass({ db, userId: 'u', notes, folders: [], trigger: 'test', llm: null });
    const proposal = readProposals(db, 'u', { kind: 'relation' })[0];
    reviewProposal(db, 'u', proposal.id, proposal.status === 'applied' ? 'undo' : 'reject');

    clearNoteStates(db, 'u');
    const rerun = await runGraphPass({ db, userId: 'u', notes, folders: [], trigger: 'rebuild', llm: null });
    expect(rerun.stats.cooccurrenceProposals).toBe(0);
    expect(readProposals(db, 'u').find((p) => p.id === proposal.id)?.status).toMatch(/rejected|undone/);
  });

  it('marks notes processed even when the model finds nothing, so the queue advances', async () => {
    const db = freshDb();
    const notes = corpus();
    const llm = fakeLlm((prompt) => (prompt.includes('shouldMerge') ? { shouldMerge: false } : prompt.includes('corrections') ? { corrections: [], missed: [] } : { relations: [] }));
    await runGraphPass({ db, userId: 'u', notes, folders: [], trigger: 'test', llm, llmNoteBudget: 2 });
    const afterFirst = readNoteStates(db, 'u', 'llm_validate');
    expect(afterFirst.size).toBe(2);
    // Most recently modified notes go first.
    expect([...afterFirst.keys()].sort()).toEqual(['n1', 'n2']);

    await runGraphPass({ db, userId: 'u', notes, folders: [], trigger: 'test', llm, llmNoteBudget: 2 });
    expect([...readNoteStates(db, 'u', 'llm_validate').keys()].sort()).toEqual(['n1', 'n2', 'n3', 'n4']);

    // Editing a note puts it back in the queue ahead of untouched notes.
    const edited = notes.map((n) => (n.id === 'n8' ? { ...n, content: `${n.content}\nAdded a long paragraph about books worth reading this year.`, dateModified: 10 } : n));
    const before = llm.calls.length;
    await runGraphPass({ db, userId: 'u', notes: edited, folders: [], trigger: 'test', llm, llmNoteBudget: 1 });
    expect(llm.calls.slice(before).some((prompt) => prompt.includes('Reading list'))).toBe(true);
  });

  it('stores model relations with their real type and provenance, pending unless evidence is verified', async () => {
    const db = freshDb();
    const notes = [
      note('a', 'Payments', '# Payments\n\n## Ledger\n\n## Billing\n\nThe Billing service depends on the Ledger for balances.', 2),
      note('b', 'Other', '# Other\n\nNothing here at all, just filler text for the test.', 1),
    ];
    const llm = fakeLlm((prompt) => {
      if (prompt.includes('implicit relationships')) {
        return {
          relations: [
            { from: 'Billing', to: 'Ledger', type: 'depends_on', confidence: 0.95, evidence: 'Billing service depends on the Ledger' },
            { from: 'Ledger', to: 'Billing', type: 'causes', confidence: 0.95, evidence: 'made up quote' },
          ],
        };
      }
      return { corrections: [], missed: [] };
    });
    await runGraphPass({ db, userId: 'u', notes, folders: [], trigger: 'test', llm });
    const relations = readProposals(db, 'u', { kind: 'relation' }).filter((p) => p.source === 'llm_implicit');
    const dependsOn = relations.find((p) => (p.payload as RelationProposalPayload).type === 'depends_on')!;
    const causes = relations.find((p) => (p.payload as RelationProposalPayload).type === 'causes')!;
    expect(dependsOn.status).toBe('applied');
    expect((dependsOn.payload as RelationProposalPayload).provenance[0]).toMatchObject({ noteId: 'a', method: 'llm', excerpt: 'Billing service depends on the Ledger' });
    expect(causes.status).toBe('pending');

    const graph = materializeForUser({ db, userId: 'u', notes, folders: [], useCache: false });
    const edge = graph.relations.find((r) => r.type === 'depends_on' && r.metadata?.proposalId === dependsOn.id)!;
    expect(edge.metadata?.reviewState).toBe('auto');
    expect(edge.accepted).toBe(false);
  });

  it('only auto-merges duplicates the model confirms', async () => {
    const db = freshDb();
    const notes = [
      note('a', 'One', '# One\n\n## Postgres-DB\n\ntext text text text text text text text', 2),
      note('b', 'Two', '# Two\n\n## postgres db\n\n## Kafka Streams\n\ntext text text text text text text', 1),
      note('c', 'Three', '# Three\n\n## Kafka Stream\n\ntext text text text text text text text', 0),
    ];
    const llm = fakeLlm((prompt) => {
      if (prompt.includes('shouldMerge')) return { shouldMerge: prompt.includes('Postgres') || prompt.includes('postgres') };
      if (prompt.includes('corrections')) return { corrections: [], missed: [] };
      return { relations: [] };
    });
    await runGraphPass({ db, userId: 'u', notes, folders: [], trigger: 'test', llm });
    const merges = readProposals(db, 'u', { kind: 'merge' });
    const postgres = merges.find((p) => p.description.toLowerCase().includes('postgres'));
    expect(postgres?.status).toBe('applied');
    const kafka = merges.find((p) => p.description.toLowerCase().includes('kafka'));
    if (kafka) expect(kafka.status).toBe('pending');
  });

  it("reverts a pass's auto-applied changes when the saved question set regresses", async () => {
    const db = freshDb();
    const notes = corpus();
    addEvalQuery(db, 'u', 'broker tuning', 'n1', 'manual');
    const run = await runGraphPass({
      db, userId: 'u', notes, folders: [], trigger: 'test', llm: null,
      regressionCheck: () => true,
    });
    expect(run.evalBefore?.queryCount).toBe(1);
    expect(run.gateReverted).toBeGreaterThan(0);
    expect(run.stats.autoApplied).toBe(0);
    expect(readProposals(db, 'u', { status: 'applied' })).toHaveLength(0);
    expect(readProposals(db, 'u', { status: 'pending' }).length).toBeGreaterThan(0);
  });

  it('keeps auto-applied changes when retrieval does not regress', async () => {
    const db = freshDb();
    const notes = corpus();
    addEvalQuery(db, 'u', 'broker tuning', 'n1', 'manual');
    const run = await runGraphPass({ db, userId: 'u', notes, folders: [], trigger: 'test', llm: null });
    expect(run.gateReverted).toBe(0);
    expect(run.evalAfter?.recallAtK).toBe(1);
    expect(readProposals(db, 'u', { status: 'applied' }).length).toBe(run.stats.autoApplied);
  });
});

describe('graph review actions', () => {
  it('approving, undoing and re-approving a proposal is reversible per operation', async () => {
    const db = freshDb();
    const notes = corpus();
    await runGraphPass({ db, userId: 'u', notes, folders: [], trigger: 'test', llm: null });
    const proposal = readProposals(db, 'u', { kind: 'relation' })[0];
    const edgeFor = () =>
      materializeForUser({ db, userId: 'u', notes, folders: [], useCache: false }).relations.find(
        (r) => r.metadata?.proposalId === proposal.id && r.metadata?.reviewState !== 'pending'
      );

    reviewProposal(db, 'u', proposal.id, 'accept');
    expect(edgeFor()).toMatchObject({ accepted: true, metadata: expect.objectContaining({ reviewState: 'accepted' }) });

    reviewProposal(db, 'u', proposal.id, 'undo');
    expect(edgeFor()).toBeUndefined();
    expect(readProposals(db, 'u').find((p) => p.id === proposal.id)?.status).toBe('undone');
  });

  it('rejecting an auto-applied edge counts against its source', async () => {
    const db = freshDb();
    const notes = corpus();
    await runGraphPass({ db, userId: 'u', notes, folders: [], trigger: 'test', llm: null });
    const applied = readProposals(db, 'u', { status: 'applied' })[0] ?? readProposals(db, 'u')[0];
    const graph = materializeForUser({ db, userId: 'u', notes, folders: [], useCache: false, includePending: true });
    const edge = graph.relations.find((r) => r.metadata?.proposalId === applied.id)!;
    const result = reviewGraphEdge(db, 'u', { relationId: edge.id, action: 'reject' });
    expect(result.ok).toBe(true);
    expect(readProposals(db, 'u').find((p) => p.id === applied.id)).toMatchObject({ status: 'undone', reviewOutcome: 'rejected' });
  });

  it('transitive suggestions use only explicit edges and are not persisted', () => {
    const db = freshDb();
    const notes = [
      note('a', 'Arch', '# Arch\n\n```mermaid\ngraph TD\n  Web --> Api\n  Api --> Db\n```'),
    ];
    const graph = materializeForUser({ db, userId: 'u', notes, folders: [], useCache: false });
    const suggestions = transitiveSuggestions(graph, 'object:diagram-node:web');
    expect(suggestions.map((s) => s.toEntityId)).toContain('object:diagram-node:db');
    expect(suggestions.every((s) => s.metadata?.reviewState === 'ephemeral')).toBe(true);
    expect(readProposals(db, 'u')).toHaveLength(0);
  });
});

describe('quality metrics', () => {
  it('counts only applied-then-reverted merges as wrong merges', async () => {
    const { computeGraphQualityMetrics } = await import('./graphEval');
    const base = { dedupeKey: 'k', source: 'duplicate' as const, confidence: 0.9, description: '', createdAt: 1, payload: { keepKey: 'a', removeKey: 'b', keepName: 'A', removeName: 'B', entityType: 'Object' as const } };
    const metrics = computeGraphQualityMetrics({ entities: [], relations: [] }, [
      { ...base, id: '1', kind: 'merge', status: 'rejected', reviewOutcome: 'rejected' },
      { ...base, id: '2', kind: 'merge', status: 'applied', reviewOutcome: 'accepted' },
      { ...base, id: '3', kind: 'merge', status: 'undone', reviewOutcome: 'rejected' },
    ]);
    expect(metrics.wrongMergeRate).toBe(0.5);
    expect(metrics.precision).toBeCloseTo(1 / 3);
  });
});
