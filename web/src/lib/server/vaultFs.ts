import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { resolveVaultRelativePath } from './vaultPaths';

export function writeVaultTextFile(vaultRoot: string, relativePath: string, content: string): string {
  const filePath = resolveVaultRelativePath(vaultRoot, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

export function readVaultTextFile(vaultRoot: string, relativePath: string): string {
  const filePath = resolveVaultRelativePath(vaultRoot, relativePath);
  return readFileSync(filePath, 'utf-8');
}
