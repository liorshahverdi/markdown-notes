import { describe, expect, it } from 'vitest';
import { synthesizeAnswerFromMemory } from './answerSynthesizer';

describe('synthesizeAnswerFromMemory', () => {
  it('answers direct what-does-use questions from note evidence', () => {
    const answer = synthesizeAnswerFromMemory({
      query: 'What does Quantum Marmot use for graph recall?',
      citations: [
        {
          id: 'note-1',
          noteId: 'note-1',
          kind: 'note',
          title: 'QA Graph Memory Note',
          relevanceScore: 0.9,
          excerpt: '# QA Graph Memory Note\n\nThe Quantum Marmot project uses Memory Beacon for graph recall.',
        },
      ],
    });

    expect(answer).toEqual({
      answer: 'Quantum Marmot uses Memory Beacon for graph recall.',
      confidence: 'high',
      sourceIds: ['note-1'],
    });
  });

  it('answers graph relation questions from graph edge evidence', () => {
    const answer = synthesizeAnswerFromMemory({
      query: 'How is QuantumMarmot related to MemoryBeacon?',
      citations: [
        {
          id: 'edge-1',
          noteId: 'note-1',
          kind: 'graph-edge',
          title: 'QuantumMarmot depends_on MemoryBeacon',
          relevanceScore: 0.8,
        },
      ],
    });

    expect(answer.answer).toBe('QuantumMarmot depends on MemoryBeacon.');
    expect(answer.confidence).toBe('high');
  });

  it('summarizes a matched meeting transcript without waiting for model fallback', () => {
    const answer = synthesizeAnswerFromMemory({
      query: 'summarize AMS-276 meeting transcript with Matt',
      citations: [
        {
          id: 'note-ams',
          noteId: 'note-ams',
          kind: 'note',
          title: 'AMS-276 meeting transcript',
          relevanceScore: 0.9,
          excerpt: `# AMS-276 meeting transcript

Matt opened the meeting by explaining that AMS-276 is blocked on the billing export contract.

The team agreed to make Priya the owner for schema cleanup and to have Matt review the migration checklist.

Action items: Matt will confirm the rollout window, Lena will update support messaging, and the team will meet again on Friday.`,
        },
      ],
    });

    expect(answer.confidence).toBe('high');
    expect(answer.answer).toContain('Summary of AMS-276 meeting transcript');
    expect(answer.answer).toContain('Matt opened the meeting');
    expect(answer.answer).toContain('Action items');
  });

  it('answers multi-fact note questions about phrases and preferred commands', () => {
    const answer = synthesizeAnswerFromMemory({
      query: 'What was the strange phrase in my Lantern Finch note, and what shortcut command did Mira Solvek prefer?',
      citations: [
        {
          id: 'note-1',
          noteId: 'note-1',
          kind: 'note',
          title: 'Project: Lantern Finch',
          relevanceScore: 0.9,
          excerpt: `## Project: Lantern Finch

Today I tested the chat recall system using a deliberately odd phrase:
**violet marmalade compass**.

Important detail: the first test user was named **Mira Solvek**, and she preferred the recall shortcut command \`/find-pebble\`.`,
        },
      ],
    });

    expect(answer.confidence).toBe('high');
    expect(answer.answer).toContain('violet marmalade compass');
    expect(answer.answer).toContain('/find-pebble');
    expect(answer.answer).toContain('Mira Solvek');
  });

  it('does not hallucinate when evidence does not answer the question', () => {
    const answer = synthesizeAnswerFromMemory({
      query: 'What database does Quantum Marmot use?',
      citations: [
        {
          id: 'note-1',
          kind: 'note',
          title: 'QA Graph Memory Note',
          relevanceScore: 0.9,
          excerpt: 'Quantum Marmot uses Memory Beacon for graph recall.',
        },
      ],
    });

    expect(answer.confidence).toBe('none');
    expect(answer.answer).toContain('I do not have enough evidence');
  });
});
