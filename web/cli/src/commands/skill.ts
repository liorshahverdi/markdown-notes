import { Command } from 'commander';
import { writeFileSync } from 'fs';
import { createClientFromOptions } from '../lib/clientFactory.js';
import { formatSkill } from '../lib/formatter.js';
import { printError, printJson } from '../lib/output.js';

export const skillCommand = new Command('skill')
  .description('Manage skills');

skillCommand
  .command('list')
  .description('List all generated skills')
  .option('--url <url>', 'API base URL')
  .option('--token <token>', 'API bearer token')
  .option('--json', 'Output machine-readable JSON')
  .action(async (opts: { url?: string; token?: string; json?: boolean }) => {
    const { client } = createClientFromOptions(opts);

    try {
      const skills = await client.listSkills();
      if (opts.json) {
        printJson({ skills, count: skills.length });
        return;
      }

      if (skills.length === 0) {
        console.log('No skills found.');
        return;
      }

      for (const skill of skills) {
        console.log(formatSkill(skill));
        console.log('');
      }

      console.log(`Total: ${skills.length} skill${skills.length === 1 ? '' : 's'}`);
    } catch (err) {
      printError(err, opts.json);
    }
  });

skillCommand
  .command('generate')
  .description('Generate a skill from notes')
  .requiredOption('--notes <noteIds>', 'Comma-separated note IDs')
  .option('--url <url>', 'API base URL')
  .option('--token <token>', 'API bearer token')
  .option('--json', 'Output machine-readable JSON')
  .action(async (opts: { notes: string; url?: string; token?: string; json?: boolean }) => {
    const { client } = createClientFromOptions(opts);
    const noteIds = opts.notes.split(',').map((s) => s.trim());

    try {
      if (!opts.json) console.log('Generating skill...');
      const skill = await client.generateSkill(noteIds);
      if (opts.json) {
        printJson({ skill });
        return;
      }
      console.log('\n' + skill);
    } catch (err) {
      printError(err, opts.json);
    }
  });

skillCommand
  .command('export')
  .description('Export a skill to a file')
  .argument('<skill-id>', 'Skill ID to export')
  .requiredOption('--out <path>', 'Output file path')
  .option('--url <url>', 'API base URL')
  .option('--token <token>', 'API bearer token')
  .option('--json', 'Output machine-readable JSON')
  .action(async (skillId: string, opts: { out: string; url?: string; token?: string; json?: boolean }) => {
    const { client } = createClientFromOptions(opts);

    try {
      const skills = await client.listSkills();
      const skill = skills.find((s) => s.id === skillId);

      if (!skill) {
        throw new Error(`Skill not found: "${skillId}"`);
      }

      const content = formatSkill(skill);
      writeFileSync(opts.out, content, 'utf-8');
      if (opts.json) {
        printJson({ ok: true, path: opts.out });
        return;
      }
      console.log(`Exported skill to ${opts.out}`);
    } catch (err) {
      printError(err, opts.json);
    }
  });
