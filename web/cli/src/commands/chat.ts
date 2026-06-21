import { Command } from 'commander';
import { createInterface } from 'readline';
import { createClientFromOptions } from '../lib/clientFactory.js';
import { formatResponse } from '../lib/formatter.js';

export const chatCommand = new Command('chat')
  .description('Interactive chat REPL with your notes')
  .option('-m, --model <model>', 'Ollama model to use')
  .option('--url <url>', 'API base URL')
  .option('--token <token>', 'API bearer token')
  .action(async (opts: { model?: string; url?: string; token?: string }) => {
    const { client } = createClientFromOptions(opts);

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('Notes Chat (type "exit" or Ctrl+C to quit)\n');

    const prompt = () => {
      rl.question('> ', async (input) => {
        const trimmed = input.trim();

        if (trimmed === 'exit' || trimmed === 'quit') {
          rl.close();
          return;
        }

        if (!trimmed) {
          prompt();
          return;
        }

        try {
          const result = await client.query(trimmed, opts.model);
          console.log('\n' + formatResponse(result.response, result.sources) + '\n');
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          console.error(`Error: ${message}\n`);
        }

        prompt();
      });
    };

    prompt();
  });
