import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ensureWikiSchemaDocs } from './schemaDocs';

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('ensureWikiSchemaDocs', () => {
  it('writes managed vault schema documentation for raw sources, wiki pages, and mutations', () => {
    const root = mkdtempSync(join(tmpdir(), 'mdnotes-schema-docs-'));
    tempDirs.push(root);

    const result = ensureWikiSchemaDocs({ userId: 'user-1', baseDir: root });

    expect(result.writtenPaths).toEqual([
      'schema/README.md',
      'schema/raw-source.md',
      'schema/wiki-page.md',
      'schema/wiki-mutation.md',
    ]);

    const overview = readFileSync(join(root, 'vaults', 'user-1', 'schema', 'README.md'), 'utf-8');
    expect(overview).toContain('LLM-maintained local wiki');
    expect(overview).toContain('raw sources');
    expect(overview).toContain('wiki pages');
    expect(overview).toContain('wiki mutations');

    const pageSchema = readFileSync(join(root, 'vaults', 'user-1', 'schema', 'wiki-page.md'), 'utf-8');
    expect(pageSchema).toContain('pageType');
    expect(pageSchema).toContain('source-summary');
    expect(pageSchema).toContain('query-filed');
  });
});
