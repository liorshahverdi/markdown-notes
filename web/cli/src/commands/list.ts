import { Command } from 'commander';
import { createClientFromOptions } from '../lib/clientFactory.js';
import { formatNote } from '../lib/formatter.js';
import { printError, printJson } from '../lib/output.js';

export const listCommand = new Command('list')
  .description('List notes')
  .option('-s, --search <query>', 'Search notes by content or title')
  .option('--url <url>', 'API base URL')
  .option('--token <token>', 'API bearer token')
  .option('--json', 'Output machine-readable JSON')
  .action(async (opts: { search?: string; url?: string; token?: string; json?: boolean }) => {
    const { client } = createClientFromOptions(opts);

    try {
      const notes = await client.listNotes(opts.search);

      if (opts.json) {
        printJson({ notes, count: notes.length });
        return;
      }

      if (notes.length === 0) {
        console.log('No notes found.');
        return;
      }

      for (const note of notes) {
        console.log(formatNote(note));
        console.log('');
      }

      console.log(`Total: ${notes.length} note${notes.length === 1 ? '' : 's'}`);
    } catch (err) {
      printError(err, opts.json);
    }
  });
