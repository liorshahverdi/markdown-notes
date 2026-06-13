export type NavItem = {
  href: string;
  label: string;
};

export const primaryNavItems: NavItem[] = [
  { href: '/', label: 'Files' },
  { href: '/graph', label: 'Graph' },
  { href: '/?chat=1', label: 'Chat' },
  { href: '/skills', label: 'Skills' },
  { href: '/help', label: 'Help' },
];

export const experimentalNavItems: NavItem[] = [
  { href: '/experimental/wiki', label: 'Experimental wiki' },
  { href: '/maintenance', label: 'Maintenance' },
];
