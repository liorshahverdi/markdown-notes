import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const mockClient = { upsertNote: vi.fn() };

async function loadImportCommand() {
  vi.resetModules();
  vi.doMock('../lib/clientFactory.js', () => ({
    createClientFromOptions: vi.fn(() => ({ client: mockClient, baseUrl: 'http://localhost:5173' })),
  }));
  const mod = await import('./import');
  return mod.importCommand;
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'notes-import-'));
  mockClient.upsertNote.mockReset();
  mockClient.upsertNote.mockResolvedValue(null);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

async function run(args: string[]) {
  const cmd = await loadImportCommand();
  await cmd.parseAsync(['node', 'notes-cli', ...args]);
}

describe('import command', () => {
  it('imports every markdown file in a directory', async () => {
    await writeFile(join(dir, 'a.md'), '# A\nalpha');
    await writeFile(join(dir, 'b.markdown'), '# B\nbeta');
    await writeFile(join(dir, 'skip.txt'), 'not markdown');
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await run([dir]);

    expect(mockClient.upsertNote).toHaveBeenCalledTimes(2);
    const titles = mockClient.upsertNote.mock.calls.map((c) => c[0].title).sort();
    expect(titles).toEqual(['a', 'b']);
  });

  it('skips node_modules and .git', async () => {
    await mkdir(join(dir, 'node_modules'), { recursive: true });
    await writeFile(join(dir, 'node_modules', 'dep.md'), 'noise');
    await writeFile(join(dir, 'keep.md'), 'signal');
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await run([dir]);

    expect(mockClient.upsertNote).toHaveBeenCalledTimes(1);
    expect(mockClient.upsertNote.mock.calls[0][0].title).toBe('keep');
  });

  it('gives a file the same id on re-import so notes update instead of duplicating', async () => {
    await writeFile(join(dir, 'a.md'), 'first');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await run([dir]);
    const firstId = mockClient.upsertNote.mock.calls[0][0].id;

    mockClient.upsertNote.mockReset();
    await writeFile(join(dir, 'a.md'), 'second');
    await run([dir]);

    expect(mockClient.upsertNote.mock.calls[0][0].id).toBe(firstId);
    expect(mockClient.upsertNote.mock.calls[0][0].content).toBe('second');
  });

  it('--split makes one note per top-level section', async () => {
    await writeFile(join(dir, 'doc.md'), 'intro text\n\n## One\nfirst\n\n## Two\nsecond\n');
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await run([dir, '--split']);

    const titles = mockClient.upsertNote.mock.calls.map((c) => c[0].title);
    expect(titles).toEqual(['doc', 'doc — One', 'doc — Two']);
  });

  it('--split ignores "##" inside fenced code blocks', async () => {
    await writeFile(
      join(dir, 'doc.md'),
      '## Real\ntext\n\n```bash\n## not a heading\necho hi\n```\n\nmore text\n'
    );
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await run([dir, '--split']);

    expect(mockClient.upsertNote).toHaveBeenCalledTimes(1);
    expect(mockClient.upsertNote.mock.calls[0][0].title).toBe('doc — Real');
  });

  it('--dry-run writes nothing', async () => {
    await writeFile(join(dir, 'a.md'), 'alpha');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await run([dir, '--dry-run']);

    expect(mockClient.upsertNote).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
  });

  it('--json reports counts and does not throw on a failed note', async () => {
    await writeFile(join(dir, 'a.md'), 'alpha');
    await writeFile(join(dir, 'b.md'), 'beta');
    mockClient.upsertNote
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('API error: 500 Internal Server Error'));
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await run([dir, '--json']);

    const payload = JSON.parse(log.mock.calls.at(-1)![0] as string);
    expect(payload.imported).toBe(1);
    expect(payload.failed).toBe(1);
    expect(payload.ok).toBe(false);
  });
});

/** `printError` ends the process; tests must intercept that to assert on output. */
function stubExit() {
  return vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`__exit__${code ?? 0}`);
  }) as never);
}

describe('import scope handling', () => {
  it('turns a 403 into one actionable message instead of failing every file', async () => {
    const d = await mkdtemp(join(tmpdir(), 'notes-import-scope-'));
    try {
      await writeFile(join(d, 'a.md'), 'alpha');
      await writeFile(join(d, 'b.md'), 'beta');
      mockClient.upsertNote.mockRejectedValue(
        new Error('API error: 403 Forbidden: Forbidden')
      );
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const exit = stubExit();
      const cmd = await loadImportCommand();
      await expect(cmd.parseAsync(['node', 'notes-cli', d])).rejects.toThrow('__exit__1');
      exit.mockRestore();

      // stops at the first 403 rather than repeating it per file
      expect(mockClient.upsertNote).toHaveBeenCalledTimes(1);
      const printed = err.mock.calls.flat().join(' ');
      expect(printed).toContain('notes:write');
    } finally {
      await rm(d, { recursive: true, force: true });
    }
  });
});

describe('oversized notes', () => {
  it('splits a note that is too long even with no headings', async () => {
    const d = await mkdtemp(join(tmpdir(), 'notes-import-big-'));
    try {
      const para = `${'word '.repeat(200).trim()}\n\n`;
      await writeFile(join(d, 'big.md'), para.repeat(10));
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const cmd = await loadImportCommand();
      await cmd.parseAsync(['node', 'notes-cli', d, '--max-words', '500']);

      const titles = mockClient.upsertNote.mock.calls.map((c) => c[0].title);
      expect(titles.length).toBeGreaterThan(1);
      expect(titles[0]).toMatch(/\(1\/\d+\)$/);
      for (const call of mockClient.upsertNote.mock.calls) {
        const words = call[0].content.split(/\s+/).filter(Boolean).length;
        expect(words).toBeLessThanOrEqual(700);
      }
    } finally {
      await rm(d, { recursive: true, force: true });
    }
  });

  it('leaves a short note as a single note with no suffix', async () => {
    const d = await mkdtemp(join(tmpdir(), 'notes-import-small-'));
    try {
      await writeFile(join(d, 'small.md'), 'just a few words here');
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const cmd = await loadImportCommand();
      await cmd.parseAsync(['node', 'notes-cli', d, '--max-words', '500']);
      expect(mockClient.upsertNote).toHaveBeenCalledTimes(1);
      expect(mockClient.upsertNote.mock.calls[0][0].title).toBe('small');
    } finally {
      await rm(d, { recursive: true, force: true });
    }
  });

  it('still splits when a stray unbalanced fence would stick the splitter on', async () => {
    const d = await mkdtemp(join(tmpdir(), 'notes-import-badfence-'));
    try {
      const para = `${'word '.repeat(150).trim()}\n\n`;
      await writeFile(join(d, 'stray.md'), para + '```\n\n' + para.repeat(20));
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const cmd = await loadImportCommand();
      await cmd.parseAsync(['node', 'notes-cli', d, '--max-words', '200']);

      expect(mockClient.upsertNote.mock.calls.length).toBeGreaterThan(2);
      const biggest = Math.max(
        ...mockClient.upsertNote.mock.calls.map(
          (c) => c[0].content.split(/\s+/).filter(Boolean).length
        )
      );
      expect(biggest).toBeLessThanOrEqual(200 * 3 + 200);
    } finally {
      await rm(d, { recursive: true, force: true });
    }
  });
});
