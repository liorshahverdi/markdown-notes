import type Database from 'better-sqlite3';
import type { RawSourceRecord } from '$lib/wiki/types';
import { generateSourceSummaryPage } from './sourceSummarizer';
import { saveWikiPage } from '$lib/wiki/wikiPageRepository';
import { updateWikiIndex } from './indexUpdater';
import { appendWikiLogEntry } from './logAppender';
import { buildPageSuggestions } from './pageSuggestionBuilder';
import { upsertEntityPages } from './entityPageUpdater';
import { upsertConceptPages } from './conceptPageUpdater';

export interface IntegrateImportedSourceInput {
  db: Database.Database;
  userId: string;
  baseDir: string;
  source: RawSourceRecord;
  sourceText: string;
}

export function integrateImportedSource(input: IntegrateImportedSourceInput): RawSourceRecord {
  const page = generateSourceSummaryPage({
    source: input.source,
    sourceText: input.sourceText,
  });

  saveWikiPage({
    db: input.db,
    userId: input.userId,
    baseDir: input.baseDir,
    record: page.record,
    markdown: page.markdown,
  });

  const suggestions = buildPageSuggestions({
    sourceId: input.source.id,
    sourceTitle: input.source.title,
    sourceText: input.sourceText,
  });
  const entityResult = upsertEntityPages({
    db: input.db,
    userId: input.userId,
    baseDir: input.baseDir,
    sourceId: input.source.id,
    sourceTitle: input.source.title,
    suggestions,
  });
  const conceptResult = upsertConceptPages({
    db: input.db,
    userId: input.userId,
    baseDir: input.baseDir,
    sourceId: input.source.id,
    sourceTitle: input.source.title,
    suggestions,
  });

  const indexPage = updateWikiIndex({
    db: input.db,
    userId: input.userId,
    baseDir: input.baseDir,
  });

  const changedPageIds = [
    page.record.id,
    ...entityResult.changedPageIds,
    ...conceptResult.changedPageIds,
    indexPage.record.id,
  ];
  const createdPageIds = [
    page.record.id,
    ...entityResult.createdPageIds,
    ...conceptResult.createdPageIds,
  ];

  appendWikiLogEntry({
    db: input.db,
    userId: input.userId,
    baseDir: input.baseDir,
    triggerType: 'ingest',
    sourceIds: [input.source.id],
    changedPageIds,
    createdPageIds,
    notes: `Imported ${input.source.title}`,
  });

  input.db
    .prepare('UPDATE raw_sources SET summaryPageId = ?, status = ? WHERE id = ?')
    .run(page.record.id, 'ingested', input.source.id);

  return {
    ...input.source,
    summaryPageId: page.record.id,
    status: 'ingested',
  };
}
