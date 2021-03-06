import commander from 'commander';
import chalk from 'chalk';
import modules from './modules/main';

import { Application } from './interface/application';
import { checkEnvironment } from './utils/env';
import { app } from './app';
import { setStore } from './utils/store';

const program = new commander.Command();
const version = '0.1.0';

program.name('tigo');
program.version(version);

console.log(chalk.hex('#f16d41')(`tigo-cli ${version}\nDeveloped by BackRunner`));

// env check
if (!app.store.envCheckPassed) {
  app.logger.info('Checking environment...');
  try {
    checkEnvironment({ minNodeVersion: 14 });
  } catch (err) {
    app.logger.error(err.message);
    process.exit(-10400);
  }
  setStore(app.store, 'envCheckPassed', true);
}

// load modules
modules.forEach(async (mount: (app: Application, program: commander.Command) => unknown): Promise<void> => {
  await mount(app, program);
});

program.parse();
