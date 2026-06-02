import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readVaultTextFile, writeVaultTextFile } from './vaultFs';
import { getUserVaultPaths } from './vaultPaths';

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('writeVaultTextFile', () => {
  it('creates parent directories and writes files under the vault root', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'mdnotes-vault-'));
    tempDirs.push(baseDir);

    const paths = getUserVaultPaths('user-1', baseDir);
    const writtenPath = writeVaultTextFile(paths.root, 'wiki/entities/concept/llm-wiki.md', '# LLM Wiki\n');

    expect(writtenPath).toBe(join(paths.root, 'wiki/entities/concept/llm-wiki.md'));
    expect(readVaultTextFile(paths.root, 'wiki/entities/concept/llm-wiki.md')).toBe('# LLM Wiki\n');
  });

  it('rejects writes outside the vault root', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'mdnotes-vault-'));
    tempDirs.push(baseDir);

    const paths = getUserVaultPaths('user-2', baseDir);

    expect(() => writeVaultTextFile(paths.root, '../escape.md', 'nope')).toThrow(/vault root/i);
  });
});

describe('readVaultTextFile', () => {
  it('reads an existing vault file by relative path', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'mdnotes-vault-'));
    tempDirs.push(baseDir);

    const paths = getUserVaultPaths('user-3', baseDir);
    writeVaultTextFile(paths.root, 'wiki/index.md', '# Index\n');

    expect(readVaultTextFile(paths.root, 'wiki/index.md')).toBe('# Index\n');
  });
});
