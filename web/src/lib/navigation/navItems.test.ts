import { describe, expect, it } from 'vitest';
import { experimentalNavItems, primaryNavItems } from './navItems';

describe('primary product navigation', () => {
  it('centers primary navigation on notes, graph, chat, skills, and help', () => {
    expect(primaryNavItems).toEqual([
      { href: '/', label: 'Files' },
      { href: '/graph', label: 'Graph' },
      { href: '/?chat=1', label: 'Chat' },
      { href: '/skills', label: 'Skills' },
      { href: '/help', label: 'Help' },
    ]);
  });

  it('does not make generated wiki pages the primary product language', () => {
    const labels = primaryNavItems.map((item) => item.label);

    expect(labels).toContain('Files');
    expect(labels).toContain('Graph');
    expect(labels).not.toContain('Wiki');
  });
});

describe('experimental navigation', () => {
  it('keeps wiki and maintenance tools outside the primary nav', () => {
    expect(experimentalNavItems).toEqual([
      { href: '/experimental/wiki', label: 'Experimental wiki' },
      { href: '/maintenance', label: 'Maintenance' },
    ]);

    expect(primaryNavItems.map((item) => item.href)).not.toContain('/experimental/wiki');
    expect(primaryNavItems.map((item) => item.href)).not.toContain('/maintenance');
  });
});
