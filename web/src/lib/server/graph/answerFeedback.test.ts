import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeDatabase } from '../database';
import { readEvalQueries, readOverlay } from './graphStore';
import { recordAnswerFeedback } from './graphService';
import { effectiveEdgeWeight } from './materialize';

const dbs: Database.Database[] = [];
afterEach(() => {
  while (dbs.length) dbs.pop()?.close();
});
function freshDb() {
  const db = new Database(':memory:');
  initializeDatabase(db);
  dbs.push(db);
  return db;
}

describe('answer feedback', () => {
  it('a thumbs-up credits the cited edges and saves the question for the retrieval check', () => {
    const db = freshDb();
    recordAnswerFeedback(db, 'u', { query: 'who owns billing?', noteId: 'n1', relationIds: ['overlay:a'], helpful: true });
    expect(readOverlay(db, 'u').usage.get('overlay:a')).toMatchObject({ helpfulCount: 1, unhelpfulCount: 0 });
    expect(readEvalQueries(db, 'u').map((q) => [q.query, q.expectedNoteId])).toEqual([['who owns billing?', 'n1']]);
  });

  it('a thumbs-down counts against the cited edges and is not saved as an expected answer', () => {
    const db = freshDb();
    recordAnswerFeedback(db, 'u', { query: 'who owns billing?', noteId: 'n1', relationIds: ['overlay:a', 'overlay:a'], helpful: false });
    expect(readOverlay(db, 'u').usage.get('overlay:a')).toMatchObject({ helpfulCount: 0, unhelpfulCount: 1 });
    expect(readEvalQueries(db, 'u')).toEqual([]);
  });
});

describe('effectiveEdgeWeight with unhelpful feedback', () => {
  const now = Date.now();
  it('lowers unreviewed edges by 0.1 per thumbs-down, at most 0.3', () => {
    const usage = (unhelpfulCount: number) => ({ relationId: 'r', useCount: 5, helpfulCount: 0, unhelpfulCount });
    expect(effectiveEdgeWeight({ confidence: 0.8, reviewState: 'auto', usage: usage(1), createdAt: now, now })).toBeCloseTo(0.7);
    expect(effectiveEdgeWeight({ confidence: 0.8, reviewState: 'auto', usage: usage(9), createdAt: now, now })).toBeCloseTo(0.5);
  });

  it('never lowers edges you accepted', () => {
    expect(
      effectiveEdgeWeight({ confidence: 0.8, reviewState: 'accepted', usage: { relationId: 'r', useCount: 1, helpfulCount: 0, unhelpfulCount: 3 }, createdAt: now, now })
    ).toBe(0.8);
  });
});
