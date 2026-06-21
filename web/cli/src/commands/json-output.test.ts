import { afterEach, describe, expect, it, vi } from 'vitest';

const mockClient = {
  listNotes: vi.fn(),
  query: vi.fn(),
  checkStatus: vi.fn(),
  getGraphStats: vi.fn(),
  getGraphEntities: vi.fn(),
  listSkills: vi.fn(),
  generateSkill: vi.fn(),
};

async function loadCommands() {
  vi.resetModules();
  vi.doMock('../lib/clientFactory.js', () => ({
    createClientFromOptions: vi.fn(() => ({ client: mockClient, baseUrl: 'http://localhost:5173' })),
  }));
  const [list, ask, status, graph, skill] = await Promise.all([
    import('./list'),
    import('./ask'),
    import('./status'),
    import('./graph'),
    import('./skill'),
  ]);
  return {
    listCommand: list.listCommand,
    askCommand: ask.askCommand,
    statusCommand: status.statusCommand,
    graphCommand: graph.graphCommand,
    skillCommand: skill.skillCommand,
  };
}

function parseJsonLog(log: ReturnType<typeof vi.spyOn>): unknown {
  expect(log).toHaveBeenCalledTimes(1);
  return JSON.parse(String(log.mock.calls[0][0]));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock('../lib/clientFactory.js');
  for (const fn of Object.values(mockClient)) fn.mockReset();
});

describe('command --json output', () => {
  it('prints note lists as JSON', async () => {
    mockClient.listNotes.mockResolvedValue([{ id: 'n1', title: 'A', content: 'Body', dateModified: 1, isPinned: false }]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { listCommand } = await loadCommands();

    await listCommand.parseAsync(['node', 'list', '--json'], { from: 'node' });

    expect(parseJsonLog(log)).toEqual({
      notes: [{ id: 'n1', title: 'A', content: 'Body', dateModified: 1, isPinned: false }],
      count: 1,
    });
  });

  it('prints ask results as JSON', async () => {
    mockClient.query.mockResolvedValue({ response: 'Answer', sources: [{ noteId: 'n1', title: 'A', relevanceScore: 0.9 }] });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { askCommand } = await loadCommands();

    await askCommand.parseAsync(['node', 'ask', 'Question?', '--json'], { from: 'node' });

    expect(parseJsonLog(log)).toEqual({
      response: 'Answer',
      sources: [{ noteId: 'n1', title: 'A', relevanceScore: 0.9 }],
    });
  });

  it('prints service status as JSON', async () => {
    mockClient.checkStatus.mockResolvedValue({ web: true, ollama: false });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { statusCommand } = await loadCommands();

    await statusCommand.parseAsync(['node', 'status', '--json'], { from: 'node' });

    expect(parseJsonLog(log)).toEqual({ web: true, ollama: false });
  });

  it('prints graph stats and entities as JSON', async () => {
    mockClient.getGraphStats.mockResolvedValue({ entities: [], relations: [], stats: { nodes: 2, edges: 1, clusters: 1 } });
    mockClient.getGraphEntities.mockResolvedValue({
      entities: [{ id: 'e1', name: 'Alpha', type: 'topic', sourceNoteIds: ['n1'] }],
      relations: [],
      stats: { nodes: 1, edges: 0, clusters: 1 },
    });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { graphCommand } = await loadCommands();

    await graphCommand.parseAsync(['node', 'graph', 'stats', '--json'], { from: 'node' });
    await graphCommand.parseAsync(['node', 'graph', 'entities', '--json'], { from: 'node' });

    expect(JSON.parse(String(log.mock.calls[0][0]))).toEqual({ stats: { nodes: 2, edges: 1, clusters: 1 } });
    expect(JSON.parse(String(log.mock.calls[1][0]))).toEqual({
      entities: [{ id: 'e1', name: 'Alpha', type: 'topic', sourceNoteIds: ['n1'] }],
      count: 1,
    });
  });

  it('prints skill list and generated skill as JSON', async () => {
    mockClient.listSkills.mockResolvedValue([{ id: 's1', name: 'Skill', domain: 'notes', type: 'single', createdAt: 1, sourceNoteIds: ['n1'], parentSkillIds: [] }]);
    mockClient.generateSkill.mockResolvedValue('# Skill');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { skillCommand } = await loadCommands();

    await skillCommand.parseAsync(['node', 'skill', 'list', '--json'], { from: 'node' });
    await skillCommand.parseAsync(['node', 'skill', 'generate', '--notes', 'n1', '--json'], { from: 'node' });

    expect(JSON.parse(String(log.mock.calls[0][0]))).toEqual({
      skills: [{ id: 's1', name: 'Skill', domain: 'notes', type: 'single', createdAt: 1, sourceNoteIds: ['n1'], parentSkillIds: [] }],
      count: 1,
    });
    expect(JSON.parse(String(log.mock.calls[1][0]))).toEqual({ skill: '# Skill' });
  });
});
