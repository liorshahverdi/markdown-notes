import { afterEach, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { getDataDir } from './dataDir';

const originalDataDir = process.env.MARKDOWN_NOTES_DATA_DIR;

afterEach(() => {
  if (originalDataDir === undefined) {
    delete process.env.MARKDOWN_NOTES_DATA_DIR;
  } else {
    process.env.MARKDOWN_NOTES_DATA_DIR = originalDataDir;
  }
});

describe('getDataDir', () => {
  it('defaults to ./data under the current working directory', () => {
    delete process.env.MARKDOWN_NOTES_DATA_DIR;

    expect(getDataDir()).toBe(resolve(process.cwd(), 'data'));
  });

  it('uses MARKDOWN_NOTES_DATA_DIR when configured', () => {
    process.env.MARKDOWN_NOTES_DATA_DIR = 'custom-data';

    expect(getDataDir()).toBe(resolve(process.cwd(), 'custom-data'));
  });
});
