import chalk from 'chalk';
import commander from 'commander';
import fs from 'fs';
import inquirer from 'inquirer';
import { Application } from '../interface/application';
import { LambdaDevConfig, RuntimeConfig } from '../interface/rc';
import { getDevConfig, getRuntimeConfig, getRuntimeConfigStatus, writeRuntimeConfig } from '../utils/env';

const getRC = async (app: Application) => {
  const status = getRuntimeConfigStatus(app.workDir);
  let rc: RuntimeConfig | LambdaDevConfig | null = await getRuntimeConfig(status);
  if (!rc) {
    // try to read dev config
    rc = getDevConfig(app);
    if (!rc) {
      console.error(chalk.red('Cannot get contents from .tigorc or .tigodev.'));
      return { status, rc: null };
    }
  }
  return { status, rc };
};

const mount = async (app: Application, program: commander.Command): Promise<void> => {
  const cmd = program.command('rc').description('Operate the server runtime config.');
  cmd
    .command('set <key> <value>')
    .description('Set a configuration item in .tigorc or .tigodev (depending on the work directory)')
    .action(async (key, value) => {
      const { status, rc } = await getRC(app);
      if (!rc) {
        return;
      }
      const keys: Array<string> = key.split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let current: any = rc.content || rc;
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
          if (/^(\+|-)?\d+.?(\d+)?$/.test(value)) {
            current[k] = parseFloat(value);
          } else if (value === 'true') {
            current[k] = true;
          } else if (value === 'false') {
            current[k] = false;
          } else {
            current[k] = value;
          }
        }
        current = obj;
      }
      if (rc.path) {
        fs.writeFileSync(<string>rc.path, JSON.stringify(rc.content, null, '  '), { encoding: 'utf-8' });
      } else {
        writeRuntimeConfig(status, <RuntimeConfig>rc);
      }
      console.log(chalk.green(`Option ${key} has been set.`));
    });
  cmd
    .command('get <key>')
    .description('Get your configuration from .tigorc or .tigodev (depending on the work directory)')
    .action(async (key) => {
      const { rc } = await getRC(app);
      if (!rc) {
        return;
      }
      const keys = key.split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let current: any = rc.content || rc;
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
  cmd
    .command('remove <key>')
    .description('Remove a configuration item from .tigorc or .tigodev')
    .action(async (key) => {
      const { status, rc } = await getRC(app);
      if (!rc) {
        return;
      }
      const keys = key.split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let current: any = rc.content || rc;
      let currentKey;
      while (keys.length) {
        currentKey = keys.shift();
        const obj = current[currentKey];
        if (typeof obj === 'undefined') {
          console.error(chalk.red('The configuration item does not exist.'));
          return;
        }
        current = obj;
      }
      // ask if sure to delete
      console.log(chalk.blue(`The configuration item is:\n${key} = ${typeof current === 'string' ? current : JSON.stringify(current, null, '  ')}`));
      const answers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'sure',
          message: 'Sure to delete it?',
          default: false,
        },
      ]);
      if (!answers.sure) {
        return;
      }
      delete current[currentKey];
      // write rc
      if (rc.path) {
        fs.writeFileSync(<string>rc.path, JSON.stringify(rc.content, null, '  '), { encoding: 'utf-8' });
      } else {
        writeRuntimeConfig(status, <RuntimeConfig>rc);
      }
      console.log(chalk.green(`Option ${key} has been removed.`));
    });
};

export default mount;
