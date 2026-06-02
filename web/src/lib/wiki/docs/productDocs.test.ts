import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(process.cwd());

function readDoc(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf-8');
}

describe('product documentation positioning', () => {
  it('positions the product as a local LLM-maintained wiki rather than generic note RAG', () => {
    const readme = readDoc('README.md');

    expect(readme).toContain('LLM-maintained local wiki');
    expect(readme).toContain('raw sources');
    expect(readme).toContain('wiki pages');
    expect(readme).toContain('wiki-first query');
    expect(readme).toContain('answer filing');
    expect(readme).toContain('wiki health');
    expect(readme).not.toContain('A local-first, AI-augmented markdown note-taking app');
  });

  it('documents the ingest/query/lint/migration verification workflow', () => {
    const guide = readDoc('TESTING_GUIDE.md');

    expect(guide).toContain('Local LLM Wiki Workflows');
    expect(guide).toContain('Import a raw source');
    expect(guide).toContain('Verify wiki-first query citations');
    expect(guide).toContain('File an answer back to the wiki');
    expect(guide).toContain('Run wiki lint');
    expect(guide).toContain('Migrate legacy notes');
  });
});
