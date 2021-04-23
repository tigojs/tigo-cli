import commander from 'commander';
import inquirer from 'inquirer';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { Application } from '../interface/application';
import { getConfig } from '../utils/config';
import { CliConfig } from '../interface/config';
import { writeCFSDeployConfig, getCFSDeployConfig } from '../utils/cfs';
import { parseHost } from '../utils/host';

interface ConfigItems {
  host: string;
  accessKey: string;
  secretKey: string;
}

const getConfigItems = (app: Application, cliConfig: CliConfig): ConfigItems => {
  const { host, access_key, secret_key } = cliConfig;
  if (!host) {
    app.logger.error('Please use the cli tool to set tigo server host first.');
    return process.exit(-10410);
  }
  if (!access_key) {
    app.logger.error('Please use the cli tool to set Web API access_key first.');
    return process.exit(-10411);
  }
  if (!secret_key) {
    app.logger.error('Please use the cli tool to set Web API secret_key first.');
    return process.exit(-10411);
  }
  return { host, accessKey: access_key, secretKey: secret_key };
};

const initCFSDeployConfig = async (app: Application): Promise<void> => {
  const configPath = path.resolve(app.workDir, './.tigo-cfs.json');
  if (fs.existsSync(configPath)) {
    // ask user to confirm
    const ans = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'CFS Deploy configuration existed, still initialize it?',
      },
    ]);
    if (!ans.confirm) {
      return process.exit(0);
    }
  }
  const cliConfig = getConfig();
  if (!cliConfig) {
    app.logger.error('Failed to get configuration of cli tool.');
    return process.exit(-10518);
  }
  const { host, accessKey, secretKey } = getConfigItems(app, cliConfig);
  const parsedHost = parseHost(host);
  await writeCFSDeployConfig(
    {
      deploy: {
        host: parsedHost.host,
        https: parsedHost.https,
        accessKey,
        secretKey,
      },
    },
    configPath
  );
  app.logger.info('Config file initialized, please set the config files which you want deploy manually.');
};

const showConfigContent = async (app: Application): Promise<void> => {
  const config = await getCFSDeployConfig(app.workDir);
  console.log(chalk.green(`Here's your CFS deploy configuration content: \n`), JSON.stringify(config, null, '  '));
  return;
};

const mount = (app: Application, program: commander.Command): void => {
  const cmd = program.command('cfs').description('tigo CFS helpers');
  cmd
    .command('init')
    .description('Initialize CFS deploy configuration.')
    .action(async () => {
      await initCFSDeployConfig(app);
    });
  cmd
    .command('show-config')
    .description('Show the content in the CFS deploy configuration.')
    .action(async () => {
      await showConfigContent(app);
    });
};

export default mount;
