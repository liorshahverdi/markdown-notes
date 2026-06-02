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

export class APIClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:5173') {
    this.baseUrl = baseUrl;
  }

  async query(query: string, model?: string): Promise<QueryResult> {
    const body: Record<string, string> = { query };
    if (model) {
      body.model = model;
    }

    const res = await fetch(`${this.baseUrl}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }

    return res.json();
  }

  async listNotes(search?: string): Promise<NoteRecord[]> {
    let url = `${this.baseUrl}/api/notes`;
    if (search) {
      url += `?search=${search}`;
    }

    const res = await fetch(url, { method: 'GET' });

    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return data.notes;
  }

  async getNote(id: string): Promise<NoteRecord | null> {
    const res = await fetch(`${this.baseUrl}/api/notes?id=${id}`, { method: 'GET' });

    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return data.note ?? null;
  }

  async listSkills(): Promise<SkillRecord[]> {
    const res = await fetch(`${this.baseUrl}/api/skills`, { method: 'GET' });

    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return data.skills;
  }

  async generateSkill(noteIds: string[]): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate', noteIds }),
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return data.skill;
  }

  async getGraphStats(): Promise<GraphData> {
    const res = await fetch(`${this.baseUrl}/api/graph`, { method: 'GET' });

    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }

    return res.json();
  }

  async getGraphEntities(type?: string): Promise<GraphData> {
    let url = `${this.baseUrl}/api/graph`;
    if (type) {
      url += `?type=${type}`;
    }

    const res = await fetch(url, { method: 'GET' });

    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }

    return res.json();
  }

  async checkStatus(): Promise<StatusResult> {
    const result: StatusResult = { web: false, ollama: false };

    try {
      const res = await fetch(`${this.baseUrl}/api/notes`, { method: 'GET' });
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
