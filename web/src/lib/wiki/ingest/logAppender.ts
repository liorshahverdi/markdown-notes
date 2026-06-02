import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { buildWikiLogPage, type BuiltWikiPage } from '$lib/wiki/templates/pageTemplates';
import { saveWikiPage } from '$lib/wiki/wikiPageRepository';

export interface AppendWikiLogEntryInput {
  db: Database.Database;
  userId: string;
  baseDir: string;
  timestamp?: number;
  triggerType: 'ingest' | 'query' | 'lint';
  sourceIds: string[];
  changedPageIds: string[];
  createdPageIds: string[];
  notes: string;
}

interface WikiMutationRow {
  timestamp: number;
  triggerType: string;
  sourceIdsJson: string;
  changedPageIdsJson: string;
  createdPageIdsJson: string;
  notes: string;
}

function formatMutationEntry(row: WikiMutationRow): string {
  const sourceIds = JSON.parse(row.sourceIdsJson) as string[];
  const changedPageIds = JSON.parse(row.changedPageIdsJson) as string[];
  const createdPageIds = JSON.parse(row.createdPageIdsJson) as string[];
  return `- ${new Date(row.timestamp).toISOString()} ${row.triggerType}: ${row.notes} | sources: ${sourceIds.join(', ') || 'none'} | changed: ${changedPageIds.join(', ') || 'none'} | created: ${createdPageIds.join(', ') || 'none'}`;
}

export function appendWikiLogEntry(input: AppendWikiLogEntryInput): BuiltWikiPage {
  const timestamp = input.timestamp ?? Date.now();
  input.db
    .prepare(`
      INSERT INTO wiki_mutations (
        id, userId, runId, timestamp, triggerType,
        sourceIdsJson, changedPageIdsJson, createdPageIdsJson, notes
      ) VALUES (
        @id, @userId, @runId, @timestamp, @triggerType,
        @sourceIdsJson, @changedPageIdsJson, @createdPageIdsJson, @notes
      )
    `)
    .run({
      id: randomUUID(),
      userId: input.userId,
      runId: randomUUID(),
      timestamp,
      triggerType: input.triggerType,
      sourceIdsJson: JSON.stringify(input.sourceIds),
      changedPageIdsJson: JSON.stringify(input.changedPageIds),
      createdPageIdsJson: JSON.stringify(input.createdPageIds),
      notes: input.notes,
    });

  const rows = input.db
    .prepare('SELECT timestamp, triggerType, sourceIdsJson, changedPageIdsJson, createdPageIdsJson, notes FROM wiki_mutations WHERE userId = ? ORDER BY timestamp ASC')
    .all(input.userId) as WikiMutationRow[];

  const page = buildWikiLogPage(rows.map(formatMutationEntry));
  saveWikiPage({
    db: input.db,
    userId: input.userId,
    baseDir: input.baseDir,
    record: page.record,
    markdown: page.markdown,
  });

  return page;
}
