import { resolve } from 'node:path';

const DEFAULT_DATA_DIR_NAME = 'data';

export function getDataDir(): string {
  const configured = process.env.MARKDOWN_NOTES_DATA_DIR?.trim();
  return resolve(process.cwd(), configured || DEFAULT_DATA_DIR_NAME);
}
