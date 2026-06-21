import { describe, expect, it } from 'vitest';
import { getRequiredApiScope, hasApiScope } from './apiScopes';

describe('api scope policy', () => {
  it('maps note reads and writes to distinct scopes', () => {
    expect(getRequiredApiScope('GET', '/api/notes')).toBe('notes:read');
    expect(getRequiredApiScope('POST', '/api/notes')).toBe('notes:write');
    expect(getRequiredApiScope('DELETE', '/api/notes')).toBe('notes:write');
  });

  it('maps query, graph, and graph reviews to their scopes', () => {
    expect(getRequiredApiScope('POST', '/api/query')).toBe('query:read');
    expect(getRequiredApiScope('GET', '/api/graph')).toBe('graph:read');
    expect(getRequiredApiScope('POST', '/api/graph/reviews')).toBe('graph:write');
  });

  it('allows session auth and checks token scopes explicitly', () => {
    expect(hasApiScope(undefined, 'notes:write')).toBe(true);
    expect(hasApiScope({ type: 'session' }, 'notes:write')).toBe(true);
    expect(hasApiScope({ type: 'api-token', tokenId: 'tok-1', scopes: ['notes:read'] }, 'notes:read')).toBe(true);
    expect(hasApiScope({ type: 'api-token', tokenId: 'tok-1', scopes: ['notes:read'] }, 'notes:write')).toBe(false);
  });
});
