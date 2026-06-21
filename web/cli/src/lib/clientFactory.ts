import { APIClient } from './apiClient.js';
import { loadConfig } from './config.js';

export interface ClientCommandOptions {
  url?: string;
  token?: string;
}

export function createClientFromOptions(opts: ClientCommandOptions = {}): { client: APIClient; baseUrl: string; token?: string } {
  const config = loadConfig();
  const baseUrl = opts.url ?? config.baseUrl;
  const token = opts.token ?? config.token;
  return { client: new APIClient({ baseUrl, token }), baseUrl, token };
}
