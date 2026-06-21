import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig, saveConfig } from './config';

const dirs: string[] = [];

function tempHome(): string {
  const dir = mkdtempSync(join(tmpdir(), 'markdown-notes-cli-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length > 0) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe('CLI config', () => {
  it('loads defaults with environment overrides', () => {
    const config = loadConfig({
      homeDir: tempHome(),
      env: { MARKDOWN_NOTES_URL: 'http://localhost:9999', MARKDOWN_NOTES_TOKEN: 'mnpat_test_secret' },
    });

    expect(config).toEqual({ baseUrl: 'http://localhost:9999', token: 'mnpat_test_secret' });
  });

  it('saves token config with user-only permissions', () => {
    const homeDir = tempHome();
    saveConfig({ baseUrl: 'http://localhost:5173', token: 'mnpat_token_secret' }, { homeDir });

    const path = join(homeDir, '.markdown-notes', 'config.json');
    expect(JSON.parse(readFileSync(path, 'utf-8'))).toEqual({
      baseUrl: 'http://localhost:5173',
      token: 'mnpat_token_secret',
    });
    expect((statSync(path).mode & 0o777).toString(8)).toBe('600');
  });
});
