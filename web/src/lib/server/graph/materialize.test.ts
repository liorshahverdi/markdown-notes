import { describe, expect, it } from 'vitest';
import type { NoteRecord } from '../../../types/note';
import type { GraphProposal } from '../../graph/proposals';
import { EMPTY_OVERLAY, effectiveEdgeWeight, materializeGraph, type GraphOverlay } from './materialize';

function note(id: string, title: string, content: string): NoteRecord {
  return { id, title, content, dateModified: 1, isPinned: false };
}

const notes = [
  note('n1', 'Kafka setup', '# Kafka setup\n\n## Zookeeper\n\nKafka depends on Zookeeper for metadata. #infra\n\n```mermaid\ngraph TD\n  Alpha --> Beta\n```'),
  note('n2', 'Ops notes', '# Ops notes\n\n## Zookeeper ops\n\nRestart zookeeper nodes one at a time. #infra'),
];

function overlay(partial: Partial<GraphOverlay>): GraphOverlay {
  return { ...EMPTY_OVERLAY, usage: new Map(), ...partial };
}

describe('materializeGraph', () => {
  it('drops self-loops from the base graph and tags base edges', () => {
    const graph = materializeGraph({ notes, folders: [] });
    expect(graph.relations.some((r) => r.fromEntityId === r.toEntityId)).toBe(false);
    expect(graph.relations.every((r) => r.metadata?.reviewState === 'base')).toBe(true);
  });

  it('applies merges as aliases: union of sources, remapped and collapsed edges', () => {
    const graph = materializeGraph({
      notes,
      folders: [],
      overlay: overlay({ aliases: [{ aliasKey: 'other:topic:zookeeper ops', canonicalKey: 'other:topic:zookeeper' }] }),
    });
    const ids = graph.entities.map((e) => e.id);
    expect(ids).not.toContain('other:topic:zookeeper ops');
    const zk = graph.entities.find((e) => e.id === 'other:topic:zookeeper')!;
    expect(zk.sourceNoteIds.sort()).toEqual(['n1', 'n2']);
    expect(graph.relations.some((r) => r.fromEntityId === 'other:topic:zookeeper' && r.toEntityId === 'note:n2')).toBe(true);
    expect(graph.resolveKey('other:topic:zookeeper ops')).toBe('other:topic:zookeeper');
  });

  it('ignores aliases whose canonical entity no longer exists', () => {
    const graph = materializeGraph({
      notes,
      folders: [],
      overlay: overlay({ aliases: [{ aliasKey: 'other:topic:zookeeper', canonicalKey: 'other:topic:gone' }] }),
    });
    expect(graph.entities.some((e) => e.id === 'other:topic:zookeeper')).toBe(true);
  });

  it('prunes automatic overlay edges whose evidence left the note but keeps user-accepted ones', () => {
    const base = {
      fromKey: 'other:topic:zookeeper',
      toKey: 'object:diagram-node:alpha',
      type: 'depends_on' as const,
      confidence: 0.9,
      method: 'llm' as const,
      metadata: null,
      createdAt: 1,
      updatedAt: 1,
    };
    const relations = [
      { ...base, id: 'auto-still-true', proposalId: 'p1', status: 'auto' as const, provenance: [{ noteId: 'n1', excerpt: 'Kafka depends on Zookeeper', method: 'llm' as const }] },
      { ...base, id: 'auto-stale', proposalId: 'p2', type: 'causes' as const, status: 'auto' as const, provenance: [{ noteId: 'n1', excerpt: 'Zookeeper causes outages', method: 'llm' as const }] },
      { ...base, id: 'accepted-stale', proposalId: 'p3', type: 'precedes' as const, status: 'accepted' as const, provenance: [{ noteId: 'n1', excerpt: 'no longer here', method: 'llm' as const }] },
    ];
    const graph = materializeGraph({ notes, folders: [], overlay: overlay({ relations }) });
    const ids = graph.relations.map((r) => r.id);
    expect(ids).toContain('overlay:auto-still-true');
    expect(ids).not.toContain('overlay:auto-stale');
    expect(ids).toContain('overlay:accepted-stale');
    expect(graph.relations.find((r) => r.id === 'overlay:auto-still-true')).toMatchObject({
      accepted: false,
      metadata: expect.objectContaining({ reviewState: 'auto', proposalId: 'p1' }),
    });
  });

  it('drops overlay edges when their source note is deleted', () => {
    const relations = [{
      id: 'r', proposalId: 'p', fromKey: 'other:topic:zookeeper', toKey: 'other:tag:infra', type: 'related_to' as const,
      confidence: 0.9, method: 'cooccurrence' as const, status: 'auto' as const,
      provenance: [{ noteId: 'n2', method: 'cooccurrence' as const }], createdAt: 1, updatedAt: 1,
    }];
    const graph = materializeGraph({ notes: [notes[0]], folders: [], overlay: overlay({ relations }) });
    expect(graph.relations.some((r) => r.id === 'overlay:r')).toBe(false);
  });

  it('includes pending proposals only when requested', () => {
    const pending: GraphProposal = {
      id: 'pp', dedupeKey: 'k', kind: 'relation', source: 'cooccurrence', status: 'pending', confidence: 0.6,
      description: 'x', createdAt: 1,
      payload: { fromKey: 'other:topic:zookeeper', toKey: 'other:tag:infra', fromName: 'Zookeeper', toName: 'infra', type: 'related_to', provenance: [] },
    };
    const without = materializeGraph({ notes, folders: [], overlay: overlay({ pendingRelations: [pending] }) });
    const withPending = materializeGraph({ notes, folders: [], overlay: overlay({ pendingRelations: [pending] }), includePending: true });
    expect(without.relations.some((r) => r.id === 'proposal:pp')).toBe(false);
    expect(withPending.relations.find((r) => r.id === 'proposal:pp')?.metadata?.reviewState).toBe('pending');
  });

  it('applies type overrides and model-found entities, removing them when the note no longer mentions them', () => {
    const custom = [{ entityKey: 'person:alice', noteId: 'n2', name: 'Alice', type: 'Person' as const, status: 'auto' as const, proposalId: 'p' }];
    const overrides = [{ entityKey: 'other:tag:infra', type: 'Object' as const, subtype: 'tool' }];
    const withAlice = materializeGraph({
      notes: [notes[0], note('n2', 'Ops notes', 'Alice restarts zookeeper. #infra')],
      folders: [],
      overlay: overlay({ customEntities: custom, overrides }),
    });
    expect(withAlice.entities.find((e) => e.id === 'person:alice')).toBeTruthy();
    expect(withAlice.relations.some((r) => r.fromEntityId === 'person:alice' && r.toEntityId === 'note:n2')).toBe(true);
    expect(withAlice.entities.find((e) => e.id === 'other:tag:infra')).toMatchObject({ type: 'Object', subtype: 'tool' });

    const withoutAlice = materializeGraph({ notes, folders: [], overlay: overlay({ customEntities: custom }) });
    expect(withoutAlice.entities.some((e) => e.id === 'person:alice')).toBe(false);
  });
});

describe('effectiveEdgeWeight', () => {
  const day = 24 * 60 * 60 * 1000;
  it('decays unused automatic edges after a grace period but never below 25%', () => {
    const now = 400 * day;
    expect(effectiveEdgeWeight({ confidence: 0.8, reviewState: 'auto', createdAt: now - 10 * day, now })).toBe(0.8);
    expect(effectiveEdgeWeight({ confidence: 0.8, reviewState: 'auto', createdAt: now - 60 * day, now })).toBeCloseTo(0.4);
    expect(effectiveEdgeWeight({ confidence: 0.8, reviewState: 'auto', createdAt: 0, now })).toBeCloseTo(0.2);
  });

  it('does not decay base/accepted edges and boosts helpful ones', () => {
    const now = 400 * day;
    expect(effectiveEdgeWeight({ confidence: 0.8, reviewState: 'base', createdAt: 0, now })).toBe(0.8);
    expect(
      effectiveEdgeWeight({ confidence: 0.8, reviewState: 'auto', createdAt: 0, now, usage: { relationId: 'r', useCount: 3, helpfulCount: 2 } })
    ).toBeCloseTo(0.9);
  });
});
