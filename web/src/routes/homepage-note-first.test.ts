import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('homepage note-first shell', () => {
  it('does not render wiki/source ingestion admin panels in the default empty homepage', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/routes/+page.svelte'), 'utf-8');

    expect(source).not.toContain('SourcesPane');
    expect(source).not.toContain('IngestReviewPanel');
  });
});
