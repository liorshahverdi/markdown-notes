import { describe, expect, it } from 'vitest';
import { experimentalNavItems, primaryNavItems } from './navItems';

describe('primary wiki navigation', () => {
  it('centers primary navigation on the wiki and the markdown vault', () => {
    expect(primaryNavItems).toEqual([
      { href: '/', label: 'Wiki' },
      { href: '/', label: 'Files' },
      { href: '/help', label: 'Help' },
    ]);
  });

  it('restores files/folders as first-class product language without returning to legacy Notes copy', () => {
    const labels = primaryNavItems.map((item) => item.label);

    expect(labels).toContain('Files');
    expect(labels).not.toContain('Notes');
    expect(labels).not.toContain('Graph');
  });
});

describe('experimental navigation', () => {
  it('keeps the knowledge graph in an experimental area outside the primary wiki nav', () => {
    expect(experimentalNavItems).toEqual([
      { href: '/experimental/knowledge-graph', label: 'Knowledge graph' },
    ]);

    expect(primaryNavItems.map((item) => item.href)).not.toContain('/experimental/knowledge-graph');
  });
});
