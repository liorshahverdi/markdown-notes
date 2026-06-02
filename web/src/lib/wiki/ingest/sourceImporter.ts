import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { RawSourceRecord } from '$lib/wiki/types';
import { ensureUserVaultDirectories } from '$lib/server/vaultPaths';
import { writeVaultTextFile } from '$lib/server/vaultFs';
import { integrateImportedSource } from './wikiIntegrator';

export interface ImportSourceTextInput {
  db: Database.Database;
  userId: string;
  baseDir: string;
  title: string;
  content: string;
  sourceType?: RawSourceRecord['sourceType'];
  sourceDate?: number | null;
  tags?: string[];
}

export interface ImportSourceTextResult {
  record: RawSourceRecord;
  absolutePath: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'source';
}

function getRawRelativePath(importedAt: number, slug: string): string {
  const year = new Date(importedAt).getUTCFullYear();
  return `raw/${year}/${slug}.md`;
}

export function importSourceText(input: ImportSourceTextInput): ImportSourceTextResult {
  const importedAt = Date.now();
  const id = randomUUID();
  const slugBase = slugify(input.title);
  const slug = `${slugBase}-${id.slice(0, 8)}`;
  const sourceType = input.sourceType ?? 'manual';
  const paths = ensureUserVaultDirectories(input.userId, input.baseDir);
  const rawPath = getRawRelativePath(importedAt, slug);
  const absolutePath = writeVaultTextFile(paths.root, rawPath, input.content);

  const record: RawSourceRecord = {
    id,
    title: input.title,
    slug,
    sourceType,
    rawPath,
    assetPaths: [],
    importedAt,
    sourceDate: input.sourceDate ?? null,
    status: 'queued',
    summaryPageId: null,
    tags: input.tags ?? [],
  };

  input.db
    .prepare(`
      INSERT INTO raw_sources (
        id, userId, title, slug, sourceType, rawPath, importedAt, sourceDate, status, assetPathsJson, tagsJson
      ) VALUES (
        @id, @userId, @title, @slug, @sourceType, @rawPath, @importedAt, @sourceDate, @status, @assetPathsJson, @tagsJson
      )
    `)
    .run({
      id: record.id,
      userId: input.userId,
      title: record.title,
      slug: record.slug,
      sourceType: record.sourceType,
      rawPath: record.rawPath,
      importedAt: record.importedAt,
      sourceDate: record.sourceDate ?? null,
      status: record.status,
      assetPathsJson: JSON.stringify(record.assetPaths),
      tagsJson: JSON.stringify(record.tags ?? []),
    });

  const integratedRecord = integrateImportedSource({
    db: input.db,
    userId: input.userId,
    baseDir: input.baseDir,
    source: record,
    sourceText: input.content,
  });

  return { record: integratedRecord, absolutePath };
}

export interface StoredRawSourceRow {
  id: string;
  userId: string;
  title: string;
  slug: string;
  sourceType: string;
  rawPath: string;
  importedAt: number;
  status: string;
}

export function listRawSourceRows(db: Database.Database, userId: string): StoredRawSourceRow[] {
  return db
    .prepare(
      `SELECT id, userId, title, slug, sourceType, rawPath, importedAt, status
       FROM raw_sources
       WHERE userId = ?
       ORDER BY importedAt DESC`
    )
    .all(userId) as StoredRawSourceRow[];
}

export function getRawSourceRow(db: Database.Database, userId: string, id: string): StoredRawSourceRow | null {
  return (
    (db
      .prepare(
        `SELECT id, userId, title, slug, sourceType, rawPath, importedAt, status
         FROM raw_sources
         WHERE userId = ? AND id = ?`
      )
      .get(userId, id) as StoredRawSourceRow | undefined) ?? null
  );
}
