import { Command } from 'commander';
import { createClientFromOptions } from '../lib/clientFactory.js';

export const statusCommand = new Command('status')
  .description('Check health of web app and Ollama')
  .option('--url <url>', 'API base URL')
  .option('--token <token>', 'API bearer token')
  .action(async (opts: { url?: string; token?: string }) => {
    const { client } = createClientFromOptions(opts);

    try {
      const status = await client.checkStatus();
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
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });
