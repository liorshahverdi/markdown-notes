import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureUserVaultDirectories } from '$lib/server/vaultPaths';

export interface EnsureWikiSchemaDocsInput {
  userId: string;
  baseDir?: string;
}

export interface EnsureWikiSchemaDocsResult {
  writtenPaths: string[];
}

const SCHEMA_DOCS: Array<{ path: string; content: string }> = [
  {
    path: 'schema/README.md',
    content: `# Managed Vault Schema

This vault is the durable artifact store for an LLM-maintained local wiki.

The app keeps original raw sources, generated wiki pages, and wiki mutations separate so users can inspect provenance and rebuild database indexes from markdown artifacts.

## Directories

- raw sources: immutable imported source text and markdown.
- wiki pages: generated source summaries, entity pages, concept pages, question pages, index, and log.
- wiki mutations: database records explaining when and why pages changed.
- schema: these human-readable schema notes.

## Operating model

1. Import raw sources without rewriting original content.
2. Generate or update wiki pages with citations back to source IDs.
3. Answer questions with wiki-first query retrieval before raw-source fallback.
4. File useful answers back to the wiki as question pages.
5. Run lint to detect broken links, orphans, stale pages, and deterministic contradictions.
`,
  },
  {
    path: 'schema/raw-source.md',
    content: `# Raw Source Schema

A raw source is immutable imported material. It may come from a legacy note, article, PDF, transcript, manual paste, or web clip.

Required metadata:

- id
- title
- slug
- sourceType
- rawPath
- importedAt
- status

Optional metadata:

- sourceDate
- checksum
- mimeType
- summaryPageId
- tags
- assetPaths

Rules:

- raw source markdown content should match the imported content byte-for-byte when possible.
- generated wiki pages cite source IDs instead of modifying raw sources.
`,
  },
  {
    path: 'schema/wiki-page.md',
    content: `# Wiki Page Schema

A wiki page is a generated, human-readable markdown artifact with cached metadata in SQLite.

Core fields:

- id
- title
- slug
- pageType
- wikiPath
- summary
- backlinks
- sourceIds
- entityKeys
- lastUpdatedAt
- lastUpdatedReason
- confidence
- openQuestions

Known pageType values:

- source-summary
- entity
- concept
- topic
- comparison
- timeline
- question
- synthesis
- index
- log

Known lastUpdatedReason values:

- ingest
- query-filed
- lint
- manual-review

Rules:

- wiki pages should use stable headings and Obsidian-style links where useful.
- source-summary pages cite raw sources.
- question pages come from answer filing after a cited answer is reviewed.
`,
  },
  {
    path: 'schema/wiki-mutation.md',
    content: `# Wiki Mutation Schema

A wiki mutation records why the generated wiki changed.

Fields:

- id
- runId
- timestamp
- triggerType
- sourceIds
- changedPageIds
- createdPageIds
- notes

Known triggerType values:

- ingest
- query
- lint

Rules:

- ingest mutations describe raw-source imports and generated/updated pages.
- query mutations describe answer filing into question pages.
- lint mutations should describe automatic or manual maintenance actions.
`,
  },
];

export function ensureWikiSchemaDocs(input: EnsureWikiSchemaDocsInput): EnsureWikiSchemaDocsResult {
  const paths = ensureUserVaultDirectories(input.userId, input.baseDir);
  const writtenPaths: string[] = [];

  for (const doc of SCHEMA_DOCS) {
    const relative = doc.path.replace(/^schema\//, '');
    writeFileSync(join(paths.schemaDir, relative), doc.content, 'utf-8');
    writtenPaths.push(doc.path);
  }

  return { writtenPaths };
}
