import type Database from 'better-sqlite3';

export interface LatestWikiMutation {
  id: string;
  runId: string;
  timestamp: number;
  triggerType: 'ingest' | 'query' | 'lint';
  sourceIds: string[];
  changedPageIds: string[];
  createdPageIds: string[];
  notes: string;
}

interface LatestWikiMutationRow {
  id: string;
  runId: string;
  timestamp: number;
  triggerType: 'ingest' | 'query' | 'lint';
  sourceIdsJson: string;
  changedPageIdsJson: string;
  createdPageIdsJson: string;
  notes: string;
}

export function getLatestWikiMutation(db: Database.Database, userId: string): LatestWikiMutation | null {
  const row = db
    .prepare(`
      SELECT id, runId, timestamp, triggerType, sourceIdsJson, changedPageIdsJson, createdPageIdsJson, notes
      FROM wiki_mutations
      WHERE userId = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `)
    .get(userId) as LatestWikiMutationRow | undefined;

  if (!row) return null;
  return {
    id: row.id,
    runId: row.runId,
    timestamp: row.timestamp,
    triggerType: row.triggerType,
    sourceIds: JSON.parse(row.sourceIdsJson),
    changedPageIds: JSON.parse(row.changedPageIdsJson),
    createdPageIds: JSON.parse(row.createdPageIdsJson),
    notes: row.notes,
  };
}
