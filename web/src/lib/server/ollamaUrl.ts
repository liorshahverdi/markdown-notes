export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function resolveOllamaBaseUrl(input?: string): string {
  if (!input) return DEFAULT_OLLAMA_URL;

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error('Invalid Ollama URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Ollama URL must use http or https');
  }

  if (!LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new Error('Ollama URL must target a loopback host');
  }

  parsed.username = '';
  parsed.password = '';
  parsed.hash = '';
  parsed.search = '';

  if (parsed.pathname === '/') {
    parsed.pathname = '';
  } else {
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  }

  return parsed.toString().replace(/\/$/, '');
}
