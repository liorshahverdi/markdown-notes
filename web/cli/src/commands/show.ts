import { Command } from 'commander';
import { createClientFromOptions } from '../lib/clientFactory.js';

export const showCommand = new Command('show')
  .description('Show full note content')
  .argument('<title>', 'Note title to display')
  .option('--url <url>', 'API base URL')
  .option('--token <token>', 'API bearer token')
  .action(async (title: string, opts: { url?: string; token?: string }) => {
    const { client } = createClientFromOptions(opts);

    try {
      // Search for notes matching the title
      const notes = await client.listNotes(title);
      const match = notes.find(
        (n) => n.title.toLowerCase() === title.toLowerCase()
      );

      if (!match) {
        console.error(`Note not found: "${title}"`);
        process.exit(1);
      }

      console.log(match.content);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });
