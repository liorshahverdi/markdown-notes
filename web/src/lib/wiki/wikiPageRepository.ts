import type Database from 'better-sqlite3';
import type { WikiPageRecord } from '$lib/wiki/types';
import { ensureUserVaultDirectories } from '$lib/server/vaultPaths';
import { writeVaultTextFile } from '$lib/server/vaultFs';

export interface SaveWikiPageInput {
  db: Database.Database;
  userId: string;
  baseDir: string;
  record: WikiPageRecord;
  markdown: string;
}

export function saveWikiPage(input: SaveWikiPageInput): string {
  const paths = ensureUserVaultDirectories(input.userId, input.baseDir);
  const absolutePath = writeVaultTextFile(paths.root, input.record.wikiPath, input.markdown);

  input.db
    .prepare(`
      INSERT OR REPLACE INTO wiki_pages (
        id, userId, title, slug, pageType, wikiPath, summary,
        backlinksJson, sourceIdsJson, entityKeysJson,
        lastUpdatedAt, lastUpdatedReason, confidence, openQuestionsJson
      ) VALUES (
        @id, @userId, @title, @slug, @pageType, @wikiPath, @summary,
        @backlinksJson, @sourceIdsJson, @entityKeysJson,
        @lastUpdatedAt, @lastUpdatedReason, @confidence, @openQuestionsJson
      )
    `)
    .run({
      id: input.record.id,
      userId: input.userId,
      title: input.record.title,
      slug: input.record.slug,
      pageType: input.record.pageType,
      wikiPath: input.record.wikiPath,
      summary: input.record.summary,
      backlinksJson: JSON.stringify(input.record.backlinks),
      sourceIdsJson: JSON.stringify(input.record.sourceIds),
      entityKeysJson: JSON.stringify(input.record.entityKeys),
      lastUpdatedAt: input.record.lastUpdatedAt,
      lastUpdatedReason: input.record.lastUpdatedReason,
      confidence: input.record.confidence ?? null,
      openQuestionsJson: JSON.stringify(input.record.openQuestions ?? []),
    });

  return absolutePath;
}
