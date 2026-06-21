import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export interface CLIConfig {
  baseUrl: string;
  token?: string;
}

interface ConfigOptions {
  homeDir?: string;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}

const DEFAULT_BASE_URL = 'http://localhost:5173';

export function getConfigPath(homeDir = homedir()): string {
  return join(homeDir, '.markdown-notes', 'config.json');
}

export function loadConfig(options: ConfigOptions = {}): CLIConfig {
  const env = options.env ?? process.env;
  let config: CLIConfig = { baseUrl: DEFAULT_BASE_URL };
  const path = getConfigPath(options.homeDir);

  if (existsSync(path)) {
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf-8')) as Partial<CLIConfig>;
      config = {
        baseUrl: typeof parsed.baseUrl === 'string' && parsed.baseUrl ? parsed.baseUrl : DEFAULT_BASE_URL,
        token: typeof parsed.token === 'string' && parsed.token ? parsed.token : undefined,
      };
    } catch {
      config = { baseUrl: DEFAULT_BASE_URL };
    }
  }

  if (env.MARKDOWN_NOTES_URL) config.baseUrl = env.MARKDOWN_NOTES_URL;
  if (env.MARKDOWN_NOTES_TOKEN) config.token = env.MARKDOWN_NOTES_TOKEN;

  return config;
}

export function saveConfig(config: CLIConfig, options: ConfigOptions = {}): void {
  const path = getConfigPath(options.homeDir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 });
  chmodSync(path, 0o600);
}

export function clearToken(options: ConfigOptions = {}): CLIConfig {
  const config = loadConfig(options);
  delete config.token;
  saveConfig(config, options);
  return config;
}
