import { Command } from 'commander';
import { APIClient } from '../lib/apiClient.js';
import { formatResponse } from '../lib/formatter.js';

export const askCommand = new Command('ask')
  .description('Query your notes using RAG')
  .argument('<query>', 'The question to ask')
  .option('-m, --model <model>', 'Ollama model to use')
  .option('--url <url>', 'API base URL', 'http://localhost:5173')
  .action(async (query: string, opts: { model?: string; url: string }) => {
    const client = new APIClient(opts.url);

    try {
      const result = await client.query(query, opts.model);
      console.log(formatResponse(result.response, result.sources));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });
