import type Database from 'better-sqlite3';
import type { GraphRelationReviewMap, GraphRelationReviewState } from '$lib/graph/relationReviewKey';

export interface UpsertGraphRelationReviewInput {
  reviewKey: string;
  fromName: string;
  toName: string;
  relationType: string;
  accepted?: boolean;
  rejected?: boolean;
}

interface GraphRelationReviewRow {
  reviewKey: string;
  accepted: number;
  rejected: number;
  updatedAt: number;
}

export function upsertGraphRelationReview(
  db: Database.Database,
  userId: string,
  review: UpsertGraphRelationReviewInput
): GraphRelationReviewState {
  const accepted = review.accepted === true;
  const rejected = review.rejected === true;
  const updatedAt = Date.now();

  db.prepare(`
    INSERT INTO graph_relation_reviews (userId, reviewKey, fromName, toName, relationType, accepted, rejected, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(userId, reviewKey) DO UPDATE SET
      fromName = excluded.fromName,
      toName = excluded.toName,
      relationType = excluded.relationType,
      accepted = excluded.accepted,
      rejected = excluded.rejected,
      updatedAt = excluded.updatedAt
  `).run(
    userId,
    review.reviewKey,
    review.fromName,
    review.toName,
    review.relationType,
    accepted ? 1 : 0,
    rejected ? 1 : 0,
    updatedAt
  );

  return { reviewKey: review.reviewKey, accepted, rejected, updatedAt };
}

export function readGraphRelationReviews(db: Database.Database, userId: string): GraphRelationReviewMap {
  const rows = db
    .prepare('SELECT reviewKey, accepted, rejected, updatedAt FROM graph_relation_reviews WHERE userId = ?')
    .all(userId) as GraphRelationReviewRow[];

  return new Map(
    rows.map((row) => [
      row.reviewKey,
      {
        reviewKey: row.reviewKey,
        accepted: row.accepted === 1,
        rejected: row.rejected === 1,
        updatedAt: row.updatedAt,
      },
    ])
  );
}
