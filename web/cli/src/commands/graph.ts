import { Command } from 'commander';
import { createClientFromOptions } from '../lib/clientFactory.js';
import { formatStats } from '../lib/formatter.js';
import { printError, printJson } from '../lib/output.js';

export const graphCommand = new Command('graph')
  .description('Knowledge graph operations');

graphCommand
  .command('stats')
  .description('Show graph statistics')
  .option('--url <url>', 'API base URL')
  .option('--token <token>', 'API bearer token')
  .option('--json', 'Output machine-readable JSON')
  .action(async (opts: { url?: string; token?: string; json?: boolean }) => {
    const { client } = createClientFromOptions(opts);

    try {
      const data = await client.getGraphStats();
      if (opts.json) {
        printJson({ stats: data.stats });
        return;
      }
      console.log(formatStats(data.stats));
    } catch (err) {
      printError(err, opts.json);
    }
  });

graphCommand
  .command('entities')
  .description('List graph entities')
  .option('--type <type>', 'Filter by entity type (person, topic, place, etc.)')
  .option('--url <url>', 'API base URL')
  .option('--token <token>', 'API bearer token')
  .option('--json', 'Output machine-readable JSON')
  .action(async (opts: { type?: string; url?: string; token?: string; json?: boolean }) => {
    const { client } = createClientFromOptions(opts);

    try {
      const data = await client.getGraphEntities(opts.type);
      if (opts.json) {
        printJson({ entities: data.entities, count: data.entities.length });
        return;
      }

      if (data.entities.length === 0) {
        console.log('No entities found.');
        return;
      }

      for (const entity of data.entities) {
        console.log(`${entity.name} [${entity.type}] (${entity.sourceNoteIds.length} notes)`);
      }

      console.log(`\nTotal: ${data.entities.length} entit${data.entities.length === 1 ? 'y' : 'ies'}`);
    } catch (err) {
      printError(err, opts.json);
    }
  });
