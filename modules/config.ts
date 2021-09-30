import commander from 'commander';
import path from 'path';
import toSnakeCase from 'to-snake-case';
import { Application } from '../interface/application';
import { getConfig, saveConfig, updateConfigItem } from '../utils/config';

const specs = {
  server_dir: (app, value: string) => {
    if (value === 'current') {
      return app.workDir;
    }
    if (value.includes('./' || '../')) {
      return path.resolve(value);
    }
    return value;
  },
  server_internal_base: (app, value: string) => {
    if (value.endsWith('/')) {
      return value.substr(0, value.length - 1);
    }
    return value;
  }
};

const mount = (app: Application, program: commander.Command): void => {
  const cmd = program
    .command('config')
    .description('Operate the configuration file.');
  cmd
    .command('set <key> [value]')
    .description('Set a configuration for CLI tool.')
    .action(async (key: string, value: string) => {
      const formattedKey = toSnakeCase(key);
      if (!specs[formattedKey]) {
        updateConfigItem(formattedKey, value || '');
      } else {
        updateConfigItem(formattedKey, specs[formattedKey](app, value || ''));
      }
      app.logger.info('Configuration was set.');
    });
  cmd
    .command('get <key>')
    .description('Get an item from CLI tool configuration.')
    .action(async (key: string) => {
      const config = getConfig();
      if (!config || !config[key]) {
        app.logger.error('Cannot find the specific configuration.');
        return;
      }
      app.logger.info(`${key}: ${config[key]}`);
    });
  cmd
    .command('remove <key>')
    .description('Remove a key from CLI tool configuration.')
    .action(async (key: string) => {
      const config = getConfig();
      if (!config || !config[key]) {
        app.logger.error('Cannot find the specific configuration.');
        return;
      }
      delete config[key];
      saveConfig(config);
      app.logger.info(`"${key}" has been removed from configuration.`);
    });
  cmd
    .command('list')
    .description('List existed configuration for cli.')
    .action(async () => {
      const config = getConfig();
      if (!config) {
        app.logger.error('Cannot find any configuration at current.');
        return;
      }
      Object.keys(config).forEach((key) => {
        let displayValue = config[key];
        if (typeof displayValue === 'string') {
          displayValue = `"${displayValue}"`;
        }
        app.logger.info(`${key}: ${displayValue}`);
      });
    });
};

export default mount;
