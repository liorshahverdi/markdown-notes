export type NavItem = {
  href: string;
  label: string;
};

export const primaryNavItems: NavItem[] = [
  { href: '/', label: 'Wiki' },
  { href: '/', label: 'Files' },
  { href: '/help', label: 'Help' },
];

export const experimentalNavItems: NavItem[] = [
  { href: '/experimental/knowledge-graph', label: 'Knowledge graph' },
];
