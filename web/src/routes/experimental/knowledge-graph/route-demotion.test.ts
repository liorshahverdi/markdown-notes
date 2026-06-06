import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const routesRoot = resolve(__dirname, '..', '..');
const appRoot = resolve(routesRoot, '..');

function readRoute(path: string) {
  return readFileSync(resolve(routesRoot, path), 'utf8');
}

describe('experimental knowledge graph route', () => {
  it('hosts the legacy graph under the experimental route tree', () => {
    expect(existsSync(resolve(routesRoot, 'experimental/knowledge-graph/+page.svelte'))).toBe(true);
  });

  it('keeps self-improvement background work out of the global layout', () => {
    const layout = readRoute('+layout.svelte');

    expect(layout).not.toContain('startSelfImproverBackground');
    expect(layout).not.toContain('stopSelfImproverBackground');
  });

  it('marks the graph page as experimental instead of primary wiki UX', () => {
    const graphPage = readRoute('experimental/knowledge-graph/+page.svelte');

    expect(graphPage).toContain('Experimental');
    expect(graphPage).toContain('Knowledge Graph');
    expect(graphPage).toContain('Back to wiki');
  });
});
