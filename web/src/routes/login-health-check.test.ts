import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('login page app shell health checks', () => {
  it('does not run protected Ollama health checks while on /login', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/routes/+layout.svelte'), 'utf-8');

    expect(source).toContain('if (!isLoginPage)');
    expect(source).toContain('checkHealth();');
  });
});
