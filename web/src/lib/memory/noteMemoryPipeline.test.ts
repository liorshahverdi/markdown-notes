import { describe, expect, it } from 'vitest';
import { buildGraphRelationReviewKey } from '$lib/graph/relationReviewKey';
import { buildNoteMemoryContext } from './noteMemoryPipeline';
import type { NoteRecord } from '../../types/note';

const notes: NoteRecord[] = [
  {
    id: 'n1',
    title: 'Ollama setup',
    content: '# Ollama setup\n\nUse nomic-embed-text for local embeddings. Ollama powers private chat recall.',
    dateModified: 10,
    isPinned: false,
  },
  {
    id: 'n2',
    title: 'Mermaid diagrams',
    content: '# Mermaid diagrams\n\nMermaid graph nodes should feed the knowledge graph.',
    dateModified: 20,
    isPinned: false,
  },
  {
    id: 'n3',
    title: 'Gardening',
    content: '# Gardening\n\nWater tomatoes weekly.',
    dateModified: 30,
    isPinned: false,
  },
];

describe('buildNoteMemoryContext', () => {
  it('retrieves note-first context with citations and no wiki citations by default', () => {
    const context = buildNoteMemoryContext({
      notes,
      folders: [],
      query: 'How does Ollama recall embeddings?',
      topK: 2,
    });

    expect(context.retrievalMode).toBe('notes-graph');
    expect(context.usedWikiContext).toBe(false);
    expect(context.citations[0]).toMatchObject({
      id: 'n1',
      kind: 'note',
      title: 'Ollama setup',
    });
    expect(context.messages.at(-1)?.content).toContain('Note: Ollama setup');
    expect(context.messages.at(-1)?.content).toContain('I remember this because of these notes and graph edges');
    expect(context.citations.every((citation) => citation.kind !== 'wiki')).toBe(true);
  });

  it('merges vector matches with full-text matches and deduplicates notes', () => {
    const context = buildNoteMemoryContext({
      notes,
      folders: [],
      query: 'graph embeddings',
      topK: 3,
      vectorMatches: [
        { noteId: 'n2', chunkText: 'Vector hit: Mermaid graph nodes', score: 0.95 },
        { noteId: 'n1', chunkText: 'Vector hit: local embeddings', score: 0.9 },
      ],
    });

    expect(context.citations.filter((citation) => citation.kind === 'note').map((citation) => citation.id)).toEqual(['n2', 'n1']);
    expect(context.messages.at(-1)?.content).toContain('Vector hit: Mermaid graph nodes');
  });

  it('reranks hybrid matches so title/exact lexical evidence beats a noisy vector hit', () => {
    const context = buildNoteMemoryContext({
      notes: [
        ...notes,
        {
          id: 'ams',
          title: 'AMS-276 meeting transcript with Matt',
          content: 'The team discussed evaluation risk, duplicative annotation, and clinical feature definitions.',
          dateModified: 40,
          isPinned: false,
        },
        {
          id: 'lantern',
          title: 'Project Lantern Finch',
          content: 'Chat recall system with memory pebbles and shortcut commands.',
          dateModified: 50,
          isPinned: false,
        },
      ],
      folders: [],
      query: 'Based on the AMS-276 meeting transcript with Matt, what risks should I watch for next week?',
      topK: 2,
      vectorMatches: [
        { noteId: 'lantern', chunkText: 'Noisy semantic hit about chat recall', score: 0.95 },
        { noteId: 'ams', chunkText: 'Semantic hit about AMS risk', score: 0.42 },
      ],
    });

    expect(context.citations.filter((citation) => citation.kind === 'note').map((citation) => citation.id)[0]).toBe('ams');
    expect(context.messages.at(-1)?.content).toContain('Note: AMS-276 meeting transcript with Matt');
  });

  it('focuses named-note questions to the explicitly referenced note for faster, cleaner prompts', () => {
    const context = buildNoteMemoryContext({
      notes: [
        ...notes,
        {
          id: 'blue-heron',
          title: 'Meeting Transcript: Blue Heron Recall Sync',
          content: 'The decision is that meeting notes should always store action items separately from general discussion. The unresolved question is whether recall should prioritize exact quotes or paraphrased intent.',
          dateModified: 40,
          isPinned: false,
        },
        {
          id: 'lantern',
          title: 'Project Lantern Finch',
          content: 'A different project about recall shortcuts and memory pebbles.',
          dateModified: 50,
          isPinned: false,
        },
      ],
      folders: [],
      query: 'in regards to the blue heron sync, What decision did the team make about action items, and what unresolved question did they leave open?',
      topK: 5,
      vectorMatches: [
        { noteId: 'lantern', chunkText: 'Noisy semantic hit about recall', score: 0.98 },
        { noteId: 'blue-heron', chunkText: 'Blue Heron action item decision and unresolved question', score: 0.5 },
      ],
    });

    const noteCitationIds = context.citations.filter((citation) => citation.kind === 'note').map((citation) => citation.id);
    expect(noteCitationIds[0]).toBe('blue-heron');
    expect(noteCitationIds).not.toContain('lantern');
    expect(context.messages.at(-1)?.content).toContain('Note: Meeting Transcript: Blue Heron Recall Sync');
    expect(context.messages.at(-1)?.content).not.toContain('Project Lantern Finch');
  });

  it('adds graph edge citations when graph neighborhood expands the match', () => {
    const context = buildNoteMemoryContext({
      notes,
      folders: [],
      query: 'Mermaid',
      topK: 5,
    });

    expect(context.graphEvidence.length).toBeGreaterThan(0);
    expect(context.citations.some((citation) => citation.kind === 'graph-edge')).toBe(true);
    expect(context.messages.at(-1)?.content).toContain('Supporting graph links');
    expect(context.messages.at(-1)?.content).toContain('Graph memory links:');
  });

  it('does not cite graph edges rejected in review state', () => {
    const unreviewed = buildNoteMemoryContext({
      notes,
      folders: [],
      query: 'Mermaid',
      topK: 5,
    });
    const target = unreviewed.graphEvidence[0];
    expect(target).toBeTruthy();

    const reviewKey = buildGraphRelationReviewKey({
      fromName: target!.from.name,
      toName: target!.to.name,
      type: target!.relation.type,
    });

    const context = buildNoteMemoryContext({
      notes,
      folders: [],
      query: 'Mermaid',
      topK: 5,
      relationReviews: new Map([[reviewKey, { reviewKey, rejected: true, accepted: false }]]),
    });

    expect(context.graphEvidence.some((item) => item.from.name === target!.from.name && item.to.name === target!.to.name)).toBe(false);
  });
});
