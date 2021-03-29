import chalk from 'chalk';
import commander from 'commander';
import { Application } from '../interface/application';
import { getRuntimeConfig, getRuntimeConfigStatus, writeRuntimeConfig } from '../utils/env';

const mount = async (app: Application, program: commander.Command): Promise<void> => {
  const cmd = program.command('rc').description('Operate the server runtime config.');
  cmd
    .command('set <key> <value>')
    .description('Set a configuration item in .tigorc or .tigodev (depending on the work directory)')
    .action(async (key, value) => {
      const status = getRuntimeConfigStatus(app.workDir);
      const rc = await getRuntimeConfig(status);
      if (!rc) {
        console.error(chalk.red('Cannot get contents from .tigorc.'));
        return;
      }
      const keys: Array<string> = key.split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let current: any = rc;
      while (keys.length) {
        const k = keys.shift();
        if (typeof k === 'undefined') {
          console.error(chalk.red('Cannot get the specific configuration item from .tigorc.'));
          return;
        }
        const obj = current[k];
        if (!obj && keys.length > 0) {
          current[k] = {};
        }
        if (keys.length === 0) {
          current[k] = value;
        }
        current = obj;
      }
      writeRuntimeConfig(status, rc);
      console.log(chalk.green(`Option ${key} has been set.`));
    });
  cmd
    .command('get <key>')
    .description('Get your configuration from .tigorc or .tigodev (depending on the work directory)')
    .action(async (key) => {
      const status = getRuntimeConfigStatus(app.workDir);
      const rc = await getRuntimeConfig(status);
      if (!rc) {
        throw new Error('Cannot get contents from .tigorc.');
      }
      const keys = key.split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let current: any = rc;
      while (keys.length) {
        const k = keys.shift();
        const obj = current[k];
        if (typeof obj === 'undefined') {
          console.error(chalk.red('The configuration item does not exist.'));
          return;
        }
        current = obj;
      }
      console.log(chalk.green(`Here's your configuration:\n${key} = ${typeof current === 'string' ? current : JSON.stringify(current, null, '  ')}`));
    });
};

export default mount;
