import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('note view graph suggestions', () => {
  const page = readFileSync(resolve(process.cwd(), 'src/routes/+page.svelte'), 'utf-8');
  const css = readFileSync(resolve(process.cwd(), 'src/app.css'), 'utf-8');

  it('shows suggestions above the preview for the open note, refreshed after each pass', () => {
    expect(page).toMatch(/<NoteSuggestions[\s\S]*noteId=\{\$selectedNote\.id\}[\s\S]*refreshKey=\{String\(\$graphStatus\?\.lastRun\?\.finishedAt/);
    expect(page.indexOf('<NoteSuggestions')).toBeLessThan(page.indexOf('<Preview markdown'));
  });

  it('highlights evidence inside the rendered preview', () => {
    expect(page).toContain('highlightQuote(previewEl, quote)');
    expect(css).toContain('::highlight(graph-evidence)');
  });

  it('hides suggestions for read-only shared notes', () => {
    expect(page).toMatch(/\{#if !isReadOnly\}\s*<NoteSuggestions/);
  });
});
