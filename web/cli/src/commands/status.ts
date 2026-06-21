import { Command } from 'commander';
import { createClientFromOptions } from '../lib/clientFactory.js';
import { printError, printJson } from '../lib/output.js';

export const statusCommand = new Command('status')
  .description('Check health of web app and Ollama')
  .option('--url <url>', 'API base URL')
  .option('--token <token>', 'API bearer token')
  .option('--json', 'Output machine-readable JSON')
  .action(async (opts: { url?: string; token?: string; json?: boolean }) => {
    const { client } = createClientFromOptions(opts);

    try {
      const status = await client.checkStatus();
      if (opts.json) {
        printJson(status);
        return;
      }
      console.log('Service Status:');
      console.log(`  Web App:  ${status.web ? '✓ Connected' : '✗ Not reachable'}`);
      console.log(`  Ollama:   ${status.ollama ? '✓ Connected' : '✗ Not reachable'}`);

      if (!status.web) {
        console.log('\nStart the web app: cd web && npm run dev');
      }
      if (!status.ollama) {
        console.log('\nStart Ollama: ollama serve');
      }
    } catch (err) {
      printError(err, opts.json);
    }
  });
