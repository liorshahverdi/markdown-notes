export const API_TOKEN_SCOPES = [
  'notes:read',
  'notes:write',
  'query:read',
  'graph:read',
  'graph:write',
  'skills:read',
  'skills:write',
  'sources:read',
  'sources:write',
  'wiki:read',
  'wiki:write',
  'tokens:manage',
] as const;

export type ApiScope = (typeof API_TOKEN_SCOPES)[number];

export const DEFAULT_API_TOKEN_SCOPES: ApiScope[] = ['notes:read', 'query:read', 'graph:read', 'skills:read'];

const KNOWN_SCOPES = new Set<string>(API_TOKEN_SCOPES);

export function normalizeApiScopes(scopes: string[]): ApiScope[] {
  const normalized = [...new Set(scopes.map((scope) => scope.trim()).filter(Boolean))];
  const invalid = normalized.filter((scope) => !KNOWN_SCOPES.has(scope));
  if (invalid.length > 0) {
    throw new Error(`Unknown API token scope: ${invalid.join(', ')}`);
  }
  return normalized as ApiScope[];
}

export type LocalAuthContext =
  | { type: 'session' }
  | { type: 'api-token'; tokenId: string; scopes: string[] };

export function hasApiScope(auth: LocalAuthContext | undefined, requiredScope: string): boolean {
  if (!auth || auth.type === 'session') return true;
  return auth.scopes.includes(requiredScope);
}

export function getRequiredApiScope(method: string, pathname: string): ApiScope | null {
  const normalizedMethod = method.toUpperCase();

  if (pathname === '/api/auth') return null;

  if (pathname === '/api/tokens') return 'tokens:manage';

  if (pathname === '/api/notes' || pathname === '/api/notes/shared') {
    if (normalizedMethod === 'GET') return 'notes:read';
    if (normalizedMethod === 'POST' || normalizedMethod === 'DELETE') return 'notes:write';
  }

  if (pathname === '/api/folders') {
    if (normalizedMethod === 'GET') return 'notes:read';
    if (normalizedMethod === 'POST' || normalizedMethod === 'DELETE') return 'notes:write';
  }

  if (pathname === '/api/query' && normalizedMethod === 'POST') return 'query:read';

  if (pathname === '/api/graph') {
    if (normalizedMethod === 'GET') return 'graph:read';
  }

  if (pathname === '/api/graph/reviews') {
    if (normalizedMethod === 'POST') return 'graph:write';
  }

  if (pathname === '/api/skills') {
    if (normalizedMethod === 'GET') return 'skills:read';
    if (normalizedMethod === 'POST') return 'skills:write';
  }

  if (pathname === '/api/sources' || pathname.startsWith('/api/sources/')) {
    if (normalizedMethod === 'GET') return 'sources:read';
    if (normalizedMethod === 'POST' || normalizedMethod === 'DELETE') return 'sources:write';
  }

  if (pathname.startsWith('/api/wiki/')) {
    if (normalizedMethod === 'GET') return 'wiki:read';
    if (normalizedMethod === 'POST' || normalizedMethod === 'DELETE') return 'wiki:write';
  }

  if (pathname === '/api/migration/notes-to-sources') return 'sources:write';

  if (pathname === '/api/images') {
    if (normalizedMethod === 'GET') return 'notes:read';
    if (normalizedMethod === 'POST' || normalizedMethod === 'DELETE') return 'notes:write';
  }

  if (pathname.startsWith('/api/ollama/')) return 'query:read';

  return null;
}
