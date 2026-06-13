import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ChatPanel note-first query integration', () => {
  it('submits through /api/query with experimental wiki context disabled by default', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/components/ChatPanel.svelte'), 'utf-8');

    expect(source).toContain("fetch('/api/query'");
    expect(source).toContain('Default chat uses notes + graph memory');
    expect(source).toContain('let includeExperimentalWiki = $state(false)');
    expect(source).toContain('includeExperimentalWiki');
    expect(source).toContain('Use experimental wiki context');
    expect(source).toContain('stream: true');
    expect(source).toContain('assistantMsg.sources = event.citations ?? event.sources ?? []');
    expect(source).not.toContain('uses wiki-first retrieval');
  });
});
