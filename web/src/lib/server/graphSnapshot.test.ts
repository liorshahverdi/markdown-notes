import { describe, expect, it } from 'vitest';
import type { FolderRecord, NoteRecord } from '../../types/note';
import { buildGraphSnapshot, selectGraphSubsetForNotes } from './graphSnapshot';

const folders: FolderRecord[] = [
  {
    id: 'f-root',
    name: 'Projects',
    parentFolderId: null,
    dateCreated: 1,
    dateModified: 1,
    sortOrder: 0,
  },
  {
    id: 'f-child',
    name: 'Deep Signal',
    parentFolderId: 'f-root',
    dateCreated: 1,
    dateModified: 1,
    sortOrder: 0,
  },
];

const notes: NoteRecord[] = [
  {
    id: 'note-1',
    title: 'Launch Plan',
    content: '# Architecture\nBuilt with Ollama\n#launch\n[Follow Up](https://example.com)',
    dateModified: 1,
    isPinned: false,
    folderId: 'f-child',
  },
  {
    id: 'note-2',
    title: 'Follow Up',
    content: '# Retrospective\nNext sprint demo on 2026-06-15',
    dateModified: 2,
    isPinned: false,
  },
];

describe('buildGraphSnapshot', () => {
  it('derives entities and relations from notes and folders', () => {
    const snapshot = buildGraphSnapshot(notes, folders);

    expect(snapshot.entities.map((entity) => entity.name)).toEqual(
      expect.arrayContaining(['Launch Plan', 'Follow Up', 'Projects', 'Deep Signal', 'Architecture', 'launch'])
    );

    expect(snapshot.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'contains' }),
        expect.objectContaining({ type: 'child_of' }),
        expect.objectContaining({ type: 'mentions' }),
        expect.objectContaining({ type: 'links_to' }),
      ])
    );
  });

  it('keeps note entities distinct by note id even when titles collide', () => {
    const duplicateTitleNotes: NoteRecord[] = [
      { id: 'a', title: 'Same Title', content: '', dateModified: 1, isPinned: false },
      { id: 'b', title: 'Same Title', content: '# Topic', dateModified: 2, isPinned: false },
    ];

    const snapshot = buildGraphSnapshot(duplicateTitleNotes, []);
    const noteEntities = snapshot.entities.filter((entity) => entity.type === 'note');

    expect(noteEntities).toHaveLength(2);
    expect(new Set(noteEntities.map((entity) => entity.id)).size).toBe(2);
  });
});

describe('selectGraphSubsetForNotes', () => {
  it('returns only entities and relations relevant to the selected note ids', () => {
    const snapshot = buildGraphSnapshot(notes, folders);

    const subset = selectGraphSubsetForNotes(snapshot, ['note-1']);

    expect(subset.entities.some((entity) => entity.name === 'Launch Plan')).toBe(true);
    expect(subset.entities.some((entity) => entity.name === 'Follow Up')).toBe(false);
    expect(subset.relations.every((relation) => {
      const from = subset.entities.find((entity) => entity.id === relation.fromEntityId);
      const to = subset.entities.find((entity) => entity.id === relation.toEntityId);
      return Boolean(from && to);
    })).toBe(true);
  });
});
