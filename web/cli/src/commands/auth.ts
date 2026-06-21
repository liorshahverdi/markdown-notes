import { Command } from 'commander';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { APIClient } from '../lib/apiClient.js';
import { clearToken, loadConfig, saveConfig } from '../lib/config.js';
import { printError, printJson } from '../lib/output.js';

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
  .option('--json', 'Output machine-readable JSON')
  .action(async (opts: { username?: string; password?: string; url?: string; tokenName: string; scopes: string; expiresInDays?: number; json?: boolean }) => {
    const config = loadConfig();
    const baseUrl = opts.url ?? config.baseUrl;
    const client = new APIClient({ baseUrl });

    try {
      if (opts.json && (!opts.username || !opts.password)) {
        throw new Error('--username and --password are required with login --json to keep stdout machine-readable');
      }
      const username = await promptIfMissing(opts.username, 'Username');
      const password = await promptIfMissing(opts.password, 'Password');
      const login = await client.login(username, password);
      const scopes = opts.scopes.split(',').map((scope) => scope.trim()).filter(Boolean);
      const created = await client.createApiToken(
        { name: opts.tokenName, scopes, expiresInDays: opts.expiresInDays },
        login.sessionCookie
      );
      saveConfig({ baseUrl, token: created.token });
      if (opts.json) {
        printJson({ ok: true, user: login.user, tokenPrefix: created.record.tokenPrefix });
        return;
      }
      console.log(`Logged in as ${login.user.username}. Stored API token ${created.record.tokenPrefix}...`);
    } catch (err) {
      printError(err, opts.json);
    }
  });

export const logoutCommand = new Command('logout')
  .description('Remove the stored local API token from CLI config')
  .option('--json', 'Output machine-readable JSON')
  .action((opts: { json?: boolean }) => {
    clearToken();
    if (opts.json) {
      printJson({ ok: true });
      return;
    }
    console.log('Removed stored Markdown Notes API token.');
  });
