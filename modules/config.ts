import commander from 'commander';
import path from 'path';
import fs from 'fs';
import { Application } from '../interface/application';
import { userDir } from '../constants/dir';

const CONFIG_PATH = path.resolve(userDir, './.tigo/userconfig.json');
const CONFIG_DIR = path.dirname(CONFIG_PATH);

if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

const getConfig = () => {
  if (!fs.existsSync(CONFIG_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, { encoding: 'utf-8' }));
};

const saveConfig = (config): void => {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, '  '), { encoding: 'utf-8' });
};

const mount = (app: Application, program: commander.Command): void => {
  const cmd = program.command('config');
  cmd
    .command('set <key> <value>')
    .description('Set configuration for cli.')
    .action(async ({ key, value }) => {
      const config = getConfig() || null;
      Object.assign(config, {
        [key]: value,
      });
      saveConfig(config);
      app.logger.info('Configuration saved.');
    });
  cmd
    .command('get <key>')
    .description('Get a configuration from storage.')
    .action(async (key: string) => {
      const config = getConfig();
      if (!config || !config[key]) {
        app.logger.info('Cannot find the specific configuration.');
        return;
      }
      app.logger.info(`${key}: ${config[key]}`);
    });
  cmd
    .command('list')
    .description('List existed configuration for cli.')
    .action(async () => {
      const config = getConfig();
      if (!config) {
        app.logger.info('Cannot find any configuration at current.');
        return;
      }
      Object.keys(config).forEach((key) => {
        app.logger.info(`${key}: ${config[key]}`);
      });
    });
};

export default mount;
