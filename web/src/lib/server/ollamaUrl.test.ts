import { describe, expect, it } from 'vitest';
import { DEFAULT_OLLAMA_URL, resolveOllamaBaseUrl } from './ollamaUrl';

describe('resolveOllamaBaseUrl', () => {
  it('returns the default URL when none is provided', () => {
    expect(resolveOllamaBaseUrl()).toBe(DEFAULT_OLLAMA_URL);
  });

  it('accepts localhost and normalizes trailing slashes', () => {
    expect(resolveOllamaBaseUrl('http://localhost:11434/')).toBe('http://localhost:11434');
    expect(resolveOllamaBaseUrl('http://127.0.0.1:11434///')).toBe('http://127.0.0.1:11434');
    expect(resolveOllamaBaseUrl('http://[::1]:11434/')).toBe('http://[::1]:11434');
  });

  it('rejects unsupported schemes', () => {
    expect(() => resolveOllamaBaseUrl('ftp://localhost:11434')).toThrow(/http/i);
  });

  it('rejects non-loopback hosts', () => {
    expect(() => resolveOllamaBaseUrl('http://example.com:11434')).toThrow(/loopback/i);
    expect(() => resolveOllamaBaseUrl('http://192.168.1.10:11434')).toThrow(/loopback/i);
  });
});
