import commander from 'commander';
import chalk from 'chalk';
import modules from './modules/main';

import { Application } from './interface/application';
import { checkEnvironment } from './utils/env';
import { app } from './app';
import { setStore } from './utils/store';
import { version } from './package.json';

const program = new commander.Command();

program.name('tigo');
program.version(version);

// env check
if (!app.store.envCheckPassed) {
  console.log(chalk.blue('Checking environment...'));
  try {
    checkEnvironment({ minNodeVersion: 14 });
  } catch (err) {
    console.log(chalk.red(err.message));
    process.exit(-10010);
  }
  setStore(app.store, 'envCheckPassed', true);
}

// load modules
modules.forEach(async (mount: (app: Application, program: commander.Command) => void): Promise<void> => {
  await mount(app, program);
});

program.parse();
