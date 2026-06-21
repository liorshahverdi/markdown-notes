import { Command } from 'commander';
import { createClientFromOptions } from '../lib/clientFactory.js';
import { formatStats } from '../lib/formatter.js';

export const graphCommand = new Command('graph')
  .description('Knowledge graph operations');

graphCommand
  .command('stats')
  .description('Show graph statistics')
  .option('--url <url>', 'API base URL')
  .option('--token <token>', 'API bearer token')
  .action(async (opts: { url?: string; token?: string }) => {
    const { client } = createClientFromOptions(opts);

    try {
      const data = await client.getGraphStats();
      console.log(formatStats(data.stats));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });

graphCommand
  .command('entities')
  .description('List graph entities')
  .option('--type <type>', 'Filter by entity type (person, topic, place, etc.)')
  .option('--url <url>', 'API base URL')
  .option('--token <token>', 'API bearer token')
  .action(async (opts: { type?: string; url?: string; token?: string }) => {
    const { client } = createClientFromOptions(opts);

    try {
      const data = await client.getGraphEntities(opts.type);

      if (data.entities.length === 0) {
        console.log('No entities found.');
        return;
      }

      for (const entity of data.entities) {
        console.log(`${entity.name} [${entity.type}] (${entity.sourceNoteIds.length} notes)`);
      }

      console.log(`\nTotal: ${data.entities.length} entit${data.entities.length === 1 ? 'y' : 'ies'}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });
