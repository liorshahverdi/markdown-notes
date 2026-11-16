import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('app shell graph status pill', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/routes/+layout.svelte'), 'utf-8');

  it('renders the graph pill wired to the Laguna start action', () => {
    expect(source).toMatch(/<GraphStatusPill[\s\S]*status=\{\$graphStatus\}[\s\S]*onStartModel=\{\(\) => restartLease\(\)\}/);
  });

  it('refreshes graph status on the same cadence as health checks, never on /login', () => {
    const loginGuard = source.indexOf('if (!isLoginPage)');
    expect(loginGuard).toBeGreaterThan(-1);
    expect(source.indexOf('refreshGraphStatus()', loginGuard)).toBeGreaterThan(loginGuard);
  });
});
