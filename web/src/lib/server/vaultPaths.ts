import { mkdirSync } from 'node:fs';
import { resolve, join, relative, sep } from 'node:path';
import { getDataDir } from './dataDir';

export interface UserVaultPaths {
  root: string;
  rawDir: string;
  wikiDir: string;
  schemaDir: string;
  stateDir: string;
}

export function getUserVaultPaths(userId: string, baseDir: string = getDataDir()): UserVaultPaths {
  const root = resolve(baseDir, 'vaults', userId);

  return {
    root,
    rawDir: join(root, 'raw'),
    wikiDir: join(root, 'wiki'),
    schemaDir: join(root, 'schema'),
    stateDir: join(root, 'state'),
  };
}

export function ensureUserVaultDirectories(userId: string, baseDir?: string): UserVaultPaths {
  const paths = getUserVaultPaths(userId, baseDir);

  mkdirSync(paths.rawDir, { recursive: true });
  mkdirSync(paths.wikiDir, { recursive: true });
  mkdirSync(paths.schemaDir, { recursive: true });
  mkdirSync(paths.stateDir, { recursive: true });

  return paths;
}

export function resolveVaultRelativePath(vaultRoot: string, relativePath: string): string {
  const root = resolve(vaultRoot);
  const resolvedPath = resolve(root, relativePath);
  const rel = relative(root, resolvedPath);

  if (rel === '..' || rel.startsWith(`..${sep}`) || rel.includes(`${sep}..${sep}`) || rel === '') {
    if (rel === '') {
      return resolvedPath;
    }
    throw new Error('Resolved path escapes the vault root');
  }

  return resolvedPath;
}
