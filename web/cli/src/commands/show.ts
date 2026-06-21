import { Command } from 'commander';
import { createClientFromOptions } from '../lib/clientFactory.js';
import { printError, printJson } from '../lib/output.js';

export const showCommand = new Command('show')
  .description('Show full note content')
  .argument('<title>', 'Note title to display')
  .option('--url <url>', 'API base URL')
  .option('--token <token>', 'API bearer token')
  .option('--json', 'Output machine-readable JSON')
  .action(async (title: string, opts: { url?: string; token?: string; json?: boolean }) => {
    const { client } = createClientFromOptions(opts);

    try {
      // Search for notes matching the title
      const notes = await client.listNotes(title);
      const match = notes.find(
        (n) => n.title.toLowerCase() === title.toLowerCase()
      );

      if (!match) {
        throw new Error(`Note not found: "${title}"`);
      }

      if (opts.json) {
        printJson({ note: match });
        return;
      }
      console.log(match.content);
    } catch (err) {
      printError(err, opts.json);
    }
  });
