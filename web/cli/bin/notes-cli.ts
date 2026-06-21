#!/usr/bin/env node

import { Command } from 'commander';
import { askCommand } from '../src/commands/ask.js';
import { chatCommand } from '../src/commands/chat.js';
import { listCommand } from '../src/commands/list.js';
import { showCommand } from '../src/commands/show.js';
import { skillCommand } from '../src/commands/skill.js';
import { graphCommand } from '../src/commands/graph.js';
import { statusCommand } from '../src/commands/status.js';
import { loginCommand, logoutCommand } from '../src/commands/auth.js';

const program = new Command();

program
  .name('notes-cli')
  .description('CLI tool for querying markdown notes')
  .version('0.1.0');

program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(askCommand);
program.addCommand(chatCommand);
program.addCommand(listCommand);
program.addCommand(showCommand);
program.addCommand(skillCommand);
program.addCommand(graphCommand);
program.addCommand(statusCommand);

program.parse();
