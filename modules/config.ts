import commander from 'commander';
import { Application } from '../interface/application';
import { getConfig, saveConfig } from '../utils/config';

const mount = (app: Application, program: commander.Command): void => {
  const cmd = program
    .command('config')
    .description('Operate the configuration file.');
  cmd
    .command('set <key> <value>')
    .description('Set configuration for cli.')
    .action(async ({ key, value }) => {
      let config = getConfig();
      if (!config) {
        config = {};
      }
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
        app.logger.error('Cannot find the specific configuration.');
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
        app.logger.error('Cannot find any configuration at current.');
        return;
      }
      Object.keys(config).forEach((key) => {
        app.logger.info(`${key}: ${config[key]}`);
      });
    });
};

export default mount;
