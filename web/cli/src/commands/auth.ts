import { Command } from 'commander';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { APIClient } from '../lib/apiClient.js';
import { clearToken, loadConfig, saveConfig } from '../lib/config.js';

const DEFAULT_LOGIN_SCOPES = ['notes:read', 'query:read', 'graph:read', 'skills:read'];

async function promptIfMissing(value: string | undefined, label: string): Promise<string> {
  if (value) return value;
  const rl = createInterface({ input, output });
  try {
    return (await rl.question(`${label}: `)).trim();
  } finally {
    rl.close();
  }
}

export const loginCommand = new Command('login')
  .description('Log in locally and store a Markdown Notes API token')
  .option('-u, --username <username>', 'Username')
  .option('-p, --password <password>', 'Password (omit to prompt)')
  .option('--url <url>', 'API base URL')
  .option('--token-name <name>', 'Name for the generated API token', 'CLI')
  .option('--scopes <scopes>', 'Comma-separated token scopes', DEFAULT_LOGIN_SCOPES.join(','))
  .option('--expires-in-days <days>', 'Token expiry in days', (value) => Number(value))
  .action(async (opts: { username?: string; password?: string; url?: string; tokenName: string; scopes: string; expiresInDays?: number }) => {
    const config = loadConfig();
    const baseUrl = opts.url ?? config.baseUrl;
    const client = new APIClient({ baseUrl });

    try {
      const username = await promptIfMissing(opts.username, 'Username');
      const password = await promptIfMissing(opts.password, 'Password');
      const login = await client.login(username, password);
      const scopes = opts.scopes.split(',').map((scope) => scope.trim()).filter(Boolean);
      const created = await client.createApiToken(
        { name: opts.tokenName, scopes, expiresInDays: opts.expiresInDays },
        login.sessionCookie
      );
      saveConfig({ baseUrl, token: created.token });
      console.log(`Logged in as ${login.user.username}. Stored API token ${created.record.tokenPrefix}...`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });

export const logoutCommand = new Command('logout')
  .description('Remove the stored local API token from CLI config')
  .action(() => {
    clearToken();
    console.log('Removed stored Markdown Notes API token.');
  });
