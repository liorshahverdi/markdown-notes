import { Command } from 'commander';
import { createClientFromOptions } from '../lib/clientFactory.js';
import { formatResponse } from '../lib/formatter.js';

export const askCommand = new Command('ask')
  .description('Query your notes using RAG')
  .argument('<query>', 'The question to ask')
  .option('-m, --model <model>', 'Ollama model to use')
  .option('--url <url>', 'API base URL')
  .option('--token <token>', 'API bearer token')
  .action(async (query: string, opts: { model?: string; url?: string; token?: string }) => {
    const { client } = createClientFromOptions(opts);

    try {
      const result = await client.query(query, opts.model);
      console.log(formatResponse(result.response, result.sources));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });
