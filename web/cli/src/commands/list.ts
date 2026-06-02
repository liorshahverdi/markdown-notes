import { Command } from 'commander';
import { APIClient } from '../lib/apiClient.js';
import { formatNote } from '../lib/formatter.js';

export const listCommand = new Command('list')
  .description('List notes')
  .option('-s, --search <query>', 'Search notes by content or title')
  .option('--url <url>', 'API base URL', 'http://localhost:5173')
  .action(async (opts: { search?: string; url: string }) => {
    const client = new APIClient(opts.url);

    try {
      const notes = await client.listNotes(opts.search);

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
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });
