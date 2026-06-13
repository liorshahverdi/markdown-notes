import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(process.cwd());

function readDoc(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf-8');
}

describe('product documentation positioning', () => {
  it('positions the product as note-first with graph memory and an experimental wiki subsystem', () => {
    const readme = readDoc('README.md');

    expect(readme).toContain('local-first markdown notes app');
    expect(readme).toContain('Default chat uses notes + graph memory');
    expect(readme).toContain('Knowledge graph');
    expect(readme).toContain('Experimental wiki/source subsystem');
    expect(readme).toContain('raw source import');
    expect(readme).not.toContain('The core architecture is:');
  });

  it('documents note/chat/graph workflows plus opt-in wiki verification', () => {
    const guide = readDoc('TESTING_GUIDE.md');

    expect(guide).toContain('Notes workflow checklist');
    expect(guide).toContain('Chat memory checklist');
    expect(guide).toContain('Knowledge graph checklist');
    expect(guide).toContain('Experimental wiki/source checklist');
    expect(guide).toContain('Import a raw source');
    expect(guide).toContain('Run wiki lint');
  });
});
