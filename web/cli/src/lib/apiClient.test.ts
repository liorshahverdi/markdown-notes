import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { APIClient, APIError } from './apiClient';

describe('APIClient', () => {
  let client: APIClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new APIClient('http://localhost:5173');
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('sends bearer tokens when configured', async () => {
      const tokenClient = new APIClient({ baseUrl: 'http://localhost:5173', token: 'mnpat_token_secret' });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ notes: [] }),
      });

      await tokenClient.listNotes();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5173/api/notes',
        { method: 'GET', headers: { Authorization: 'Bearer mnpat_token_secret' } }
      );
    });

    it('uses default base URL when none provided', () => {
      const defaultClient = new APIClient();
      // We verify by making a call and checking the URL
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ notes: [] }),
      });
      defaultClient.listNotes();
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5173/api/notes',
        expect.any(Object)
      );
    });

    it('uses custom base URL when provided', () => {
      const customClient = new APIClient('http://example.com:3000');
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ notes: [] }),
      });
      customClient.listNotes();
      expect(mockFetch).toHaveBeenCalledWith(
        'http://example.com:3000/api/notes',
        expect.any(Object)
      );
    });
  });

  describe('auth and token management', () => {
    it('logs in with username/password and captures the session cookie', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { getSetCookie: () => ['session=abc; Path=/; HttpOnly'], get: () => null },
        json: () => Promise.resolve({ user: { id: 'u1', username: 'tester' } }),
      });

      const result = await client.login('tester', 'secret');

      expect(result.sessionCookie).toBe('session=abc');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5173/api/auth',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ action: 'login', username: 'tester', password: 'secret' }),
        })
      );
    });

    it('creates API tokens with a session cookie', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: 'mnpat_token_secret', record: { id: 'tok-1' } }),
      });

      const result = await client.createApiToken({ name: 'CLI', scopes: ['notes:read'] }, 'session=abc');

      expect(result.token).toBe('mnpat_token_secret');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5173/api/tokens',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: 'session=abc' },
          body: JSON.stringify({ name: 'CLI', scopes: ['notes:read'] }),
        }
      );
    });
  });

  describe('query', () => {
    it('sends POST to /api/query with query string', async () => {
      const mockResponse = {
        response: 'Test response',
        sources: [{ noteId: '1', title: 'Note 1', relevanceScore: 0.95 }],
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.query('What is TypeScript?');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5173/api/query',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'What is TypeScript?' }),
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it('includes model when provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: '', sources: [] }),
      });

      await client.query('test', 'llama3');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5173/api/query',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'test', model: 'llama3' }),
        }
      );
    });

    it('throws structured API errors on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: () => Promise.resolve({ error: 'Ollama unavailable' }),
      });

      await expect(client.query('test')).rejects.toMatchObject({
        name: 'APIError',
        status: 503,
        statusText: 'Service Unavailable',
        body: { error: 'Ollama unavailable' },
      } satisfies Partial<APIError>);
      await expect(client.query('test')).rejects.toThrow('API error: 503 Service Unavailable: Ollama unavailable');
    });
  });

  describe('listNotes', () => {
    it('sends GET to /api/notes', async () => {
      const notes = [
        { id: '1', title: 'Note 1', content: '# Note 1', dateModified: 1000, isPinned: false },
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ notes }),
      });

      const result = await client.listNotes();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5173/api/notes',
        { method: 'GET' }
      );
      expect(result).toEqual(notes);
    });

    it('includes search param when provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ notes: [] }),
      });

      await client.listNotes('typescript');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5173/api/notes?search=typescript',
        { method: 'GET' }
      );
    });
  });

  describe('getNote', () => {
    it('sends GET to /api/notes?id=noteId', async () => {
      const note = { id: 'abc', title: 'My Note', content: '# My Note', dateModified: 1000, isPinned: false };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ note }),
      });

      const result = await client.getNote('abc');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5173/api/notes?id=abc',
        { method: 'GET' }
      );
      expect(result).toEqual(note);
    });

    it('returns null when note not found', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ note: null }),
      });

      const result = await client.getNote('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('listSkills', () => {
    it('sends GET to /api/skills', async () => {
      const skills = [
        { id: 's1', name: 'TypeScript Basics', domain: 'programming', type: 'single', createdAt: 1000, sourceNoteIds: ['1'], parentSkillIds: [] },
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ skills }),
      });

      const result = await client.listSkills();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5173/api/skills',
        { method: 'GET' }
      );
      expect(result).toEqual(skills);
    });
  });

  describe('generateSkill', () => {
    it('sends POST to /api/skills with noteIds', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ skill: '# Generated Skill\n\nContent here' }),
      });

      const result = await client.generateSkill(['note1', 'note2']);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5173/api/skills',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'generate', noteIds: ['note1', 'note2'] }),
        }
      );
      expect(result).toBe('# Generated Skill\n\nContent here');
    });
  });

  describe('getGraphStats', () => {
    it('sends GET to /api/graph', async () => {
      const graphData = {
        entities: [{ id: 'e1', name: 'TypeScript', type: 'topic', sourceNoteIds: ['1'] }],
        relations: [],
        stats: { nodes: 1, edges: 0, clusters: 0 },
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(graphData),
      });

      const result = await client.getGraphStats();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5173/api/graph',
        { method: 'GET' }
      );
      expect(result).toEqual(graphData);
    });
  });

  describe('getGraphEntities', () => {
    it('sends GET to /api/graph?type=person for filtered entities', async () => {
      const graphData = {
        entities: [{ id: 'e1', name: 'Alice', type: 'person', sourceNoteIds: ['1'] }],
        relations: [],
        stats: { nodes: 1, edges: 0, clusters: 0 },
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(graphData),
      });

      const result = await client.getGraphEntities('person');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5173/api/graph?type=person',
        { method: 'GET' }
      );
      expect(result).toEqual(graphData);
    });
  });

  describe('checkStatus', () => {
    it('returns web: true when API is reachable', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/notes')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ notes: [] }) });
        }
        if (url.includes('11434')) {
          return Promise.resolve({ ok: true });
        }
        return Promise.reject(new Error('unexpected'));
      });

      const result = await client.checkStatus();
      expect(result.web).toBe(true);
    });

    it('returns web: false when API is unreachable', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await client.checkStatus();
      expect(result.web).toBe(false);
      expect(result.ollama).toBe(false);
    });

    it('returns ollama: true when Ollama is reachable', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/notes')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ notes: [] }) });
        }
        if (url.includes('11434')) {
          return Promise.resolve({ ok: true });
        }
        return Promise.reject(new Error('unexpected'));
      });

      const result = await client.checkStatus();
      expect(result.ollama).toBe(true);
    });

    it('returns ollama: false when Ollama is unreachable', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/notes')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ notes: [] }) });
        }
        return Promise.reject(new Error('Connection refused'));
      });

      const result = await client.checkStatus();
      expect(result.web).toBe(true);
      expect(result.ollama).toBe(false);
    });
  });
});
