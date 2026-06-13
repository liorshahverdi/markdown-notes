import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('chat query param integration', () => {
  it('opens the chat panel when the route has ?chat=1', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/routes/+page.svelte'), 'utf-8');

    expect(source).toContain("$page.url.searchParams.get('chat') === '1'");
    expect(source).toContain('chatOpen.set(true)');
  });
});
