import { Command } from 'commander';
import { createClientFromOptions } from '../lib/clientFactory.js';
import { formatResponse } from '../lib/formatter.js';
import { printError, printJson } from '../lib/output.js';

export const askCommand = new Command('ask')
  .description('Query your notes using RAG')
  .argument('<query>', 'The question to ask')
  .option('-m, --model <model>', 'Ollama model to use')
  .option('--url <url>', 'API base URL')
  .option('--token <token>', 'API bearer token')
  .option('--json', 'Output machine-readable JSON')
  .action(async (query: string, opts: { model?: string; url?: string; token?: string; json?: boolean }) => {
    const { client } = createClientFromOptions(opts);

    try {
      const result = await client.query(query, opts.model);
      if (opts.json) {
        printJson(result);
        return;
      }
      console.log(formatResponse(result.response, result.sources));
    } catch (err) {
      printError(err, opts.json);
    }
  });
