import { cleanup, render, screen, fireEvent } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GraphEdgeDetailDrawer from './GraphEdgeDetailDrawer.svelte';
import type { GraphEntity, GraphRelation } from '../../types/graph';

const entities: GraphEntity[] = [
  { id: 'a', name: 'Alpha', type: 'Other', sourceNoteIds: ['n1'] },
  { id: 'b', name: 'Beta', type: 'Other', sourceNoteIds: ['n1'] },
];
const edge: GraphRelation = {
  id: 'e1',
  fromEntityId: 'a',
  toEntityId: 'b',
  type: 'depends_on',
  confidence: 0.64,
  provenance: [{ noteId: 'n1', excerpt: 'Alpha depends on Beta.', method: 'llm' }],
};
const notes = [{ id: 'n1', title: 'Alpha note', content: 'Alpha depends on Beta.' }];

afterEach(() => cleanup());

describe('GraphEdgeDetailDrawer', () => {
  it('renders endpoints, type, confidence, provenance, and note links', () => {
    render(GraphEdgeDetailDrawer, { edge, entities, notes });

    expect(screen.getByText('Alpha --depends_on--> Beta')).toBeInTheDocument();
    expect(screen.getByText('64% confidence')).toBeInTheDocument();
    expect(screen.getByText('Alpha depends on Beta.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open Alpha note/i })).toBeInTheDocument();
    expect(screen.getByText('llm')).toBeInTheDocument();
  });

  it('calls review and generation actions with the selected edge', async () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    const onGenerateSkill = vi.fn();
    render(GraphEdgeDetailDrawer, { edge, entities, notes, onAccept, onReject, onGenerateSkill });

    await fireEvent.click(screen.getByRole('button', { name: /accept edge/i }));
    await fireEvent.click(screen.getByRole('button', { name: /reject edge/i }));
    await fireEvent.click(screen.getByRole('button', { name: /generate skill from this edge/i }));

    expect(onAccept).toHaveBeenCalledWith(edge);
    expect(onReject).toHaveBeenCalledWith(edge);
    expect(onGenerateSkill).toHaveBeenCalledWith(edge, entities[0], entities[1]);
  });
});
