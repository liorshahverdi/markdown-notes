export class APIError extends Error {
  name = 'APIError';

  constructor(
    public status: number,
    public statusText: string,
    public body?: unknown
  ) {
    const bodyMessage =
      body && typeof body === 'object' && 'error' in body && typeof (body as { error?: unknown }).error === 'string'
        ? `: ${(body as { error: string }).error}`
        : '';
    super(`API error: ${status} ${statusText}${bodyMessage}`);
  }
}

export interface NoteRecord {
  id: string;
  title: string;
  content: string;
  dateModified: number;
  isPinned: boolean;
}

export interface SkillRecord {
  id: string;
  name: string;
  domain: string;
  type: string;
  createdAt: number;
  sourceNoteIds: string[];
  parentSkillIds: string[];
}

export interface GraphData {
  entities: Array<{ id: string; name: string; type: string; sourceNoteIds: string[] }>;
  relations: Array<{ id: string; fromEntityId: string; toEntityId: string; type: string; weight?: number }>;
  stats: { nodes: number; edges: number; clusters: number };
}

export interface QueryResult {
  response: string;
  sources: Array<{ noteId: string; title: string; relevanceScore: number }>;
}

export interface StatusResult {
  web: boolean;
  ollama: boolean;
}

export interface ApiTokenRecord {
  id: string;
  name: string;
  tokenId: string;
  tokenPrefix: string;
  scopes: string[];
  createdAt: number;
  lastUsedAt: number | null;
  expiresAt: number | null;
  revokedAt: number | null;
}

interface APIClientOptions {
  baseUrl?: string;
  token?: string;
}

export class APIClient {
  private baseUrl: string;
  private token?: string;

  constructor(options: string | APIClientOptions = 'http://localhost:5173') {
    if (typeof options === 'string') {
      this.baseUrl = options;
    } else {
      this.baseUrl = options.baseUrl ?? 'http://localhost:5173';
      this.token = options.token;
    }
  }

  private authHeaders(extra?: Record<string, string>, sessionCookie?: string): Record<string, string> | undefined {
    const headers: Record<string, string> = { ...(extra ?? {}) };
    if (sessionCookie) {
      headers.Cookie = sessionCookie;
    } else if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return Object.keys(headers).length > 0 ? headers : undefined;
  }

  private requestInit(method: string, extraHeaders?: Record<string, string>, sessionCookie?: string): RequestInit {
    const headers = this.authHeaders(extraHeaders, sessionCookie);
    return headers ? { method, headers } : { method };
  }

  private async parseJsonResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = undefined;
      }
      throw new APIError(res.status, res.statusText, body);
    }
    return res.json() as Promise<T>;
  }

  async login(username: string, password: string): Promise<{ user: { id: string; username: string }; sessionCookie: string }> {
    const res = await fetch(`${this.baseUrl}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', username, password }),
    });

    const data = await this.parseJsonResponse<{ user: { id: string; username: string } }>(res);
    const headers = res.headers as Headers & { getSetCookie?: () => string[] };
    const setCookie = headers.getSetCookie?.()[0] ?? headers.get('set-cookie') ?? '';
    const sessionCookie = setCookie.split(';')[0];
    if (!sessionCookie) {
      throw new Error('Login succeeded but no session cookie was returned');
    }
    return { user: data.user, sessionCookie };
  }

  async createApiToken(
    input: { name: string; scopes?: string[]; expiresInDays?: number },
    sessionCookie?: string
  ): Promise<{ token: string; record: ApiTokenRecord }> {
    const res = await fetch(`${this.baseUrl}/api/tokens`, {
      method: 'POST',
      headers: this.authHeaders({ 'Content-Type': 'application/json' }, sessionCookie),
      body: JSON.stringify(input),
    });
    return this.parseJsonResponse<{ token: string; record: ApiTokenRecord }>(res);
  }

  async listApiTokens(sessionCookie?: string): Promise<ApiTokenRecord[]> {
    const res = await fetch(`${this.baseUrl}/api/tokens`, this.requestInit('GET', undefined, sessionCookie));
    const data = await this.parseJsonResponse<{ tokens: ApiTokenRecord[] }>(res);
    return data.tokens;
  }

  async revokeApiToken(id: string, sessionCookie?: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/tokens`, {
      method: 'DELETE',
      headers: this.authHeaders({ 'Content-Type': 'application/json' }, sessionCookie),
      body: JSON.stringify({ id }),
    });
    await this.parseJsonResponse<{ ok: boolean }>(res);
  }

  async query(query: string, model?: string): Promise<QueryResult> {
    const body: Record<string, string> = { query };
    if (model) {
      body.model = model;
    }

    const res = await fetch(`${this.baseUrl}/api/query`, {
      method: 'POST',
      headers: this.authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });

    return this.parseJsonResponse<QueryResult>(res);
  }

  async listNotes(search?: string): Promise<NoteRecord[]> {
    let url = `${this.baseUrl}/api/notes`;
    if (search) {
      url += `?search=${encodeURIComponent(search)}`;
    }

    const res = await fetch(url, this.requestInit('GET'));
    const data = await this.parseJsonResponse<{ notes: NoteRecord[] }>(res);
    return data.notes;
  }

  async getNote(id: string): Promise<NoteRecord | null> {
    const res = await fetch(`${this.baseUrl}/api/notes?id=${encodeURIComponent(id)}`, this.requestInit('GET'));
    const data = await this.parseJsonResponse<{ note?: NoteRecord | null }>(res);
    return data.note ?? null;
  }

  async listSkills(): Promise<SkillRecord[]> {
    const res = await fetch(`${this.baseUrl}/api/skills`, this.requestInit('GET'));
    const data = await this.parseJsonResponse<{ skills: SkillRecord[] }>(res);
    return data.skills;
  }

  async generateSkill(noteIds: string[]): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/skills`, {
      method: 'POST',
      headers: this.authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ action: 'generate', noteIds }),
    });

    const data = await this.parseJsonResponse<{ skill: string }>(res);
    return data.skill;
  }

  async getGraphStats(): Promise<GraphData> {
    const res = await fetch(`${this.baseUrl}/api/graph`, this.requestInit('GET'));
    return this.parseJsonResponse<GraphData>(res);
  }

  async getGraphEntities(type?: string): Promise<GraphData> {
    let url = `${this.baseUrl}/api/graph`;
    if (type) {
      url += `?type=${encodeURIComponent(type)}`;
    }

    const res = await fetch(url, this.requestInit('GET'));
    return this.parseJsonResponse<GraphData>(res);
  }

  async checkStatus(): Promise<StatusResult> {
    const result: StatusResult = { web: false, ollama: false };

    try {
      const res = await fetch(`${this.baseUrl}/api/notes`, this.requestInit('GET'));
      result.web = res.ok;
    } catch {
      result.web = false;
    }

    try {
      const res = await fetch('http://localhost:11434/api/tags');
      result.ollama = res.ok;
    } catch {
      result.ollama = false;
    }

    return result;
  }
}
