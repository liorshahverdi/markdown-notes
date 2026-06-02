import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ChatPanel wiki-first query integration', () => {
  it('submits new chat questions through the server /api/query route', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/components/ChatPanel.svelte'), 'utf-8');

    expect(source).toContain("fetch('/api/query'");
    expect(source).toContain('coverage: result.coverage');
    expect(source).toContain('usedRawFallback: result.usedRawFallback');
    expect(source).toContain('sources: result.citations ?? result.sources ?? []');
  });
});
