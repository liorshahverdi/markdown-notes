import { describe, expect, it } from 'vitest';
import {
  ensureUserVaultDirectories,
  getUserVaultPaths,
  resolveVaultRelativePath,
} from './vaultPaths';

describe('getUserVaultPaths', () => {
  it('returns deterministic per-user paths rooted under the configured base directory', () => {
    const paths = getUserVaultPaths('user-123', '/tmp/mdnotes-test-data');

    expect(paths.root).toBe('/tmp/mdnotes-test-data/vaults/user-123');
    expect(paths.rawDir).toBe('/tmp/mdnotes-test-data/vaults/user-123/raw');
    expect(paths.wikiDir).toBe('/tmp/mdnotes-test-data/vaults/user-123/wiki');
    expect(paths.schemaDir).toBe('/tmp/mdnotes-test-data/vaults/user-123/schema');
    expect(paths.stateDir).toBe('/tmp/mdnotes-test-data/vaults/user-123/state');
  });
});

describe('ensureUserVaultDirectories', () => {
  it('creates the expected vault directories on disk', () => {
    const baseDir = '/tmp/mdnotes-test-data-ensure';
    const paths = ensureUserVaultDirectories('user-abc', baseDir);

    expect(paths.root).toContain('/tmp/mdnotes-test-data-ensure/vaults/user-abc');
    expect(paths.rawDir).toContain('/raw');
    expect(paths.wikiDir).toContain('/wiki');
    expect(paths.schemaDir).toContain('/schema');
    expect(paths.stateDir).toContain('/state');
  });
});

describe('resolveVaultRelativePath', () => {
  it('resolves safe paths under the vault root', () => {
    const paths = getUserVaultPaths('user-safe', '/tmp/mdnotes-test-data-safe');

    expect(resolveVaultRelativePath(paths.root, 'wiki/index.md')).toBe(
      '/tmp/mdnotes-test-data-safe/vaults/user-safe/wiki/index.md'
    );
  });

  it('rejects path traversal attempts', () => {
    const paths = getUserVaultPaths('user-safe', '/tmp/mdnotes-test-data-safe');

    expect(() => resolveVaultRelativePath(paths.root, '../secrets.txt')).toThrow(/vault root/i);
    expect(() => resolveVaultRelativePath(paths.root, 'wiki/../../secrets.txt')).toThrow(/vault root/i);
  });
});
