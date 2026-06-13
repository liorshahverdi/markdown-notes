import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let tempDir = '';

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'mdnotes-images-'));
  process.env.MARKDOWN_NOTES_DATA_DIR = tempDir;
});

afterEach(() => {
  delete process.env.MARKDOWN_NOTES_DATA_DIR;
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  vi.resetModules();
});

describe('/api/images', () => {
  it('rejects svg uploads', async () => {
    const { POST } = await import('./+server');
    const form = new Map();
    form.set('image', { type: 'image/svg+xml', size: 11, name: 'x.svg', arrayBuffer: async () => Buffer.from('<svg></svg>') });

    await expect(POST({ request: { formData: async () => form }, locals: { user: { id: 'u1' } } } as any)).rejects.toMatchObject({ status: 400 });
  });

  it('stores and serves uploads from a user-scoped directory', async () => {
    const { POST, GET } = await import('./+server');
    const form = new Map();
    form.set('image', { type: 'image/png', size: 3, name: 'x.png', arrayBuffer: async () => Buffer.from('abc') });

    const postResponse = await POST({ request: { formData: async () => form }, locals: { user: { id: 'u1' } } } as any);
    const { filename } = await postResponse.json();

    const getResponse = await GET({ url: new URL(`http://test/api/images?path=${filename}`), locals: { user: { id: 'u1' } } } as any);
    expect(getResponse.headers.get('Content-Type')).toBe('image/png');
    expect(await getResponse.text()).toBe('abc');

    await expect(GET({ url: new URL(`http://test/api/images?path=${filename}`), locals: { user: { id: 'u2' } } } as any)).rejects.toMatchObject({ status: 404 });
  });
});
