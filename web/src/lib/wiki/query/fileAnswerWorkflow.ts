import type Database from 'better-sqlite3';
import { classifyAnswerForFiling } from './answerClassifier';
import { draftAnswerPageUpdate } from './answerToPage';
import { saveWikiPage } from '$lib/wiki/wikiPageRepository';
import { updateWikiIndex } from '$lib/wiki/ingest/indexUpdater';
import { appendWikiLogEntry } from '$lib/wiki/ingest/logAppender';
import type { WikiCitation } from './queryPipeline';
import type { WikiCoverage } from './wikiSearch';

export interface FileAnswerToWikiInput {
  db: Database.Database;
  userId: string;
  baseDir: string;
  question: string;
  answer: string;
  citations: WikiCitation[];
  coverage: WikiCoverage;
  usedRawFallback: boolean;
}

export interface FileAnswerToWikiResult {
  status: 'filed' | 'skipped';
  pageId?: string;
  wikiPath?: string;
  reasons: string[];
}

export function fileAnswerToWiki(input: FileAnswerToWikiInput): FileAnswerToWikiResult {
  const classification = classifyAnswerForFiling(input);
  if (!classification.shouldFile) {
    return { status: 'skipped', reasons: classification.reasons };
  }

  const draft = draftAnswerPageUpdate(input);
  saveWikiPage({
    db: input.db,
    userId: input.userId,
    baseDir: input.baseDir,
    record: draft.record,
    markdown: draft.markdown,
  });

  const indexPage = updateWikiIndex({ db: input.db, userId: input.userId, baseDir: input.baseDir });
  appendWikiLogEntry({
    db: input.db,
    userId: input.userId,
    baseDir: input.baseDir,
    triggerType: 'query',
    sourceIds: draft.record.sourceIds,
    changedPageIds: [draft.record.id, indexPage.record.id],
    createdPageIds: [draft.record.id],
    notes: `Filed answer to wiki page ${draft.record.id}`,
  });

  return {
    status: 'filed',
    pageId: draft.record.id,
    wikiPath: draft.record.wikiPath,
    reasons: classification.reasons,
  };
}
