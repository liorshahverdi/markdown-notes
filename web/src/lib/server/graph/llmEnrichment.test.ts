import { describe, expect, it } from 'vitest';
import type { GraphEntity } from '../../../types/graph';
import type { NoteRecord } from '../../../types/note';
import {
  buildNameResolver,
  parseImplicitRelations,
  parseJsonLoose,
  parseValidation,
  relevantEntitiesForNote,
} from './llmEnrichment';

const note: NoteRecord = {
  id: 'n1',
  title: 'Platform',
  content: 'The Email service depends on Postgres for storage. Alice owns the Email service.',
  dateModified: 1,
  isPinned: false,
};

const entities: GraphEntity[] = [
  { id: 'object:email service', name: 'Email service', type: 'Object', sourceNoteIds: ['n1'] },
  { id: 'object:postgres', name: 'Postgres', type: 'Object', sourceNoteIds: ['n2'] },
  { id: 'person:alice', name: 'Alice', type: 'Object', sourceNoteIds: ['n1'] },
  { id: 'other:topic:ai', name: 'AI', type: 'Other', subtype: 'topic', sourceNoteIds: ['n3'] },
  { id: 'object:redis', name: 'Redis', type: 'Object', sourceNoteIds: ['n4'] },
];

describe('relevantEntitiesForNote', () => {
  it('sends only entities from this note or mentioned verbatim in it', () => {
    const relevant = relevantEntitiesForNote(note, entities).map((e) => e.id);
    expect(relevant).toEqual(expect.arrayContaining(['object:email service', 'person:alice', 'object:postgres']));
    expect(relevant).not.toContain('object:redis');
    // "AI" appears inside "Email" but not as a word.
    expect(relevant).not.toContain('other:topic:ai');
  });
});

describe('buildNameResolver', () => {
  it('matches exact/normalized names only, never substrings', () => {
    const resolve = buildNameResolver(entities);
    expect(resolve('email SERVICE')?.id).toBe('object:email service');
    expect(resolve('Email')).toBeNull();
    expect(resolve('A')).toBeNull();
  });
});

describe('parseImplicitRelations', () => {
  it('keeps the real relation type, verifies evidence, and rejects unknown names and types', () => {
    const allowed = relevantEntitiesForNote(note, entities);
    const raw = parseJsonLoose('```json\n' + JSON.stringify({
      relations: [
        { from: 'Email service', to: 'Postgres', type: 'depends_on', confidence: 0.9, evidence: 'The Email service depends on Postgres' },
        { from: 'Alice', to: 'Email service', type: 'owns', confidence: 0.95, evidence: 'Alice is the CTO' },
        { from: 'Email', to: 'Postgres', type: 'depends_on', confidence: 0.9, evidence: 'x' },
        { from: 'Alice', to: 'Postgres', type: 'loves', confidence: 0.9, evidence: 'x' },
      ],
    }) + '\n```');
    const { accepted, rejected } = parseImplicitRelations(raw, note, allowed);
    expect(accepted).toHaveLength(2);
    expect(accepted[0]).toMatchObject({ type: 'depends_on', evidenceVerified: true, confidence: 0.9 });
    expect(accepted[1]).toMatchObject({ type: 'owns', evidenceVerified: false, confidence: 0.5 });
    expect(rejected.map((r) => r.reason)).toEqual(['unknown entity name', 'unsupported type loves']);
  });
});

describe('parseValidation', () => {
  it('turns corrections into retypes and keeps only missed entities that appear verbatim and are new', () => {
    const own = entities.filter((e) => e.sourceNoteIds.includes('n1'));
    const result = parseValidation(
      {
        corrections: [{ name: 'Alice', suggestedType: 'Person', suggestedSubtype: null, reason: 'a person' }],
        missed: [
          { name: 'Postgres', type: 'Object', confidence: 0.9 },
          { name: 'storage', type: 'Object', confidence: 0.6 },
          { name: 'Bob', type: 'Person', confidence: 0.9 },
        ],
      },
      note,
      own,
      entities
    );
    expect(result.corrections).toEqual([expect.objectContaining({ entity: expect.objectContaining({ id: 'person:alice' }), newType: 'Person' })]);
    expect(result.missed.map((m) => m.name)).toEqual(['storage']);
    expect(result.missed[0].entityKey).toBe('object:storage');
  });
});
