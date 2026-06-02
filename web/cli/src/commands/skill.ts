import { Command } from 'commander';
import { writeFileSync } from 'fs';
import { APIClient } from '../lib/apiClient.js';
import { formatSkill } from '../lib/formatter.js';

export const skillCommand = new Command('skill')
  .description('Manage skills');

skillCommand
  .command('list')
  .description('List all generated skills')
  .option('--url <url>', 'API base URL', 'http://localhost:5173')
  .action(async (opts: { url: string }) => {
    const client = new APIClient(opts.url);

    try {
      const skills = await client.listSkills();

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
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });

skillCommand
  .command('generate')
  .description('Generate a skill from notes')
  .requiredOption('--notes <noteIds>', 'Comma-separated note IDs')
  .option('--url <url>', 'API base URL', 'http://localhost:5173')
  .action(async (opts: { notes: string; url: string }) => {
    const client = new APIClient(opts.url);
    const noteIds = opts.notes.split(',').map((s) => s.trim());

    try {
      console.log('Generating skill...');
      const skill = await client.generateSkill(noteIds);
      console.log('\n' + skill);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });

skillCommand
  .command('export')
  .description('Export a skill to a file')
  .argument('<skill-id>', 'Skill ID to export')
  .requiredOption('--out <path>', 'Output file path')
  .option('--url <url>', 'API base URL', 'http://localhost:5173')
  .action(async (skillId: string, opts: { out: string; url: string }) => {
    const client = new APIClient(opts.url);

    try {
      const skills = await client.listSkills();
      const skill = skills.find((s) => s.id === skillId);

      if (!skill) {
        console.error(`Skill not found: "${skillId}"`);
        process.exit(1);
      }

      const content = formatSkill(skill);
      writeFileSync(opts.out, content, 'utf-8');
      console.log(`Exported skill to ${opts.out}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });
