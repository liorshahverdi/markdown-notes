import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeDatabase } from '$lib/server/database';
import { upsertGraphRelationReview } from '$lib/server/graphRelationReviews';
import type { NoteRecord } from '../../../types/note';

const dbs: Database.Database[] = [];
const notes: NoteRecord[] = [
  {
    id: 'n1',
    title: 'Diagram Note',
    content: `# Diagram Note

\`\`\`mermaid
graph TD
  AlphaProject --> BetaSystem
\`\`\`
`,
    dateModified: 1,
    isPinned: false,
  },
];

afterEach(() => {
  vi.doUnmock('$lib/server/database');
  vi.doUnmock('$lib/server/notesFile');
  while (dbs.length > 0) dbs.pop()?.close();
});

async function loadRouteWithDb(db: Database.Database) {
  vi.resetModules();
  vi.doMock('$lib/server/database', () => ({ getDb: () => db }));
  vi.doMock('$lib/server/notesFile', () => ({ readNotes: () => notes, readFolders: () => [] }));
  return import('./+server');
}

describe('GET /api/graph review filtering', () => {
  it('excludes rejected edges by default and includes them only when requested', async () => {
    const db = new Database(':memory:');
    dbs.push(db);
    initializeDatabase(db);
    upsertGraphRelationReview(db, 'user-1', {
      reviewKey: 'depends_on:alphaproject->betasystem',
      fromName: 'AlphaProject',
      toName: 'BetaSystem',
      relationType: 'depends_on',
      accepted: false,
      rejected: true,
    });
    const route = await loadRouteWithDb(db);

    const normalResponse = await route.GET({
      url: new URL('http://localhost/api/graph'),
      locals: { user: { id: 'user-1', username: 'tester' } },
    } as Parameters<typeof route.GET>[0]);
    const normal = await normalResponse.json();
    expect(normal.relations.some((relation: { type: string }) => relation.type === 'depends_on')).toBe(false);

    const diagnosticsResponse = await route.GET({
      url: new URL('http://localhost/api/graph?includeRejected=1'),
      locals: { user: { id: 'user-1', username: 'tester' } },
    } as Parameters<typeof route.GET>[0]);
    const diagnostics = await diagnosticsResponse.json();
    expect(diagnostics.relations).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'depends_on', rejected: true }),
    ]));
  });
});
