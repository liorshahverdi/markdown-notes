import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeDatabase } from './database';
import { readGraphRelationReviews, upsertGraphRelationReview } from './graphRelationReviews';

const dbs: Database.Database[] = [];

afterEach(() => {
  while (dbs.length > 0) dbs.pop()?.close();
});

function setupDb() {
  const db = new Database(':memory:');
  dbs.push(db);
  initializeDatabase(db);
  return db;
}

describe('graph relation reviews', () => {
  it('persists user accept/reject decisions by stable review key', () => {
    const db = setupDb();

    upsertGraphRelationReview(db, 'user-1', {
      reviewKey: 'depends_on:alpha->beta',
      fromName: 'Alpha',
      toName: 'Beta',
      relationType: 'depends_on',
      accepted: false,
      rejected: true,
    });

    const reviews = readGraphRelationReviews(db, 'user-1');

    expect(reviews.get('depends_on:alpha->beta')).toMatchObject({
      reviewKey: 'depends_on:alpha->beta',
      accepted: false,
      rejected: true,
    });
  });
});
