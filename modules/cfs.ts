import commander from 'commander';
import inquirer from 'inquirer';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import chalk from 'chalk';
import { Response } from 'superagent';
import { getAgent } from '@tigojs/api-request';
import { Application } from '../interface/application';
import { getConfig } from '../utils/config';
import { CliConfig } from '../interface/config';
import { writeCFSDeployConfig, getCFSDeployConfig } from '../utils/cfs';
import { parseHost } from '../utils/host';
import { CFSDeployConfig, CFSDeployInfo, ConfigFileInfo } from '../interface/cfs';

interface ConfigItems {
  host: string;
  accessKey: string;
  secretKey: string;
  internalBase: string;
}

const ALLOWED_TYPES = ['json', 'xml', 'yaml'];

const getConfigItems = (app: Application, cliConfig: CliConfig): ConfigItems => {
  const { api_host: host, access_key, secret_key, server_internal_base } = cliConfig;
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
  if (!server_internal_base) {
    app.logger.warn('Server internal base is not set, use "/api" by default.');
  }
  return { host, accessKey: access_key, secretKey: secret_key, internalBase: server_internal_base || '/api' };
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
  const { host, accessKey, secretKey, internalBase } = getConfigItems(app, cliConfig);
  const parsedHost = parseHost(host);
  await writeCFSDeployConfig(
    {
      deploy: {
        host: parsedHost.host,
        https: parsedHost.https,
        base: internalBase,
        accessKey,
        secretKey,
      },
    },
    app.workDir
  );
  app.logger.info('Config file initialized, please set the config files which you want deploy manually.');
};

const showConfigContent = async (app: Application): Promise<void> => {
  const config = await getCFSDeployConfig(app.workDir);
  console.log(chalk.green(`Here's your CFS deploy configuration content: \n`), JSON.stringify(config, null, '  '));
  return;
};

const deployConfig = (app: Application, fileInfo: ConfigFileInfo, deployInfo: CFSDeployInfo) => {
  return new Promise<void>(async (resolve, reject) => {
    let port: number;
    if (deployInfo.port) {
      port = deployInfo.port;
    } else {
      port = deployInfo.https ? 443 : 80;
    }
    const { accessKey: ak, secretKey: sk } = deployInfo;
    if (!ak || !sk) {
      return reject(new Error('Necessary access key or secret is wrong.'));
    }
    const agent = getAgent({
      host: deployInfo.host,
      port,
      https: deployInfo.https,
      base: deployInfo.base,
      ak,
      sk,
    });
    const action = fileInfo.id ? 'edit' : 'add';
    if (!fileInfo.path) {
      return reject(new Error('File path is necessary.'));
    }
    const filePath = path.resolve(app.workDir, fileInfo.path);
    if (!fs.existsSync(filePath)) {
      return reject(new Error('Cannot find the target configuration file.'));
    }
    const extname = path.extname(fileInfo.path);
    let type = extname.toLowerCase();
    if (type.length) {
      type = type.substr(1);
    }
    if (!ALLOWED_TYPES.includes(type)) {
      return reject(new Error('The file type cannot be accepted by the server.'));
    }
    let { name: fileName } = fileInfo;
    if (!fileName) {
      app.logger.warn(`File name is empty, using basename by default.`);
      fileName = path.basename(fileInfo.path, extname);
    }
    const fileCotent = await fsp.readFile(filePath, { encoding: 'utf-8' });
    // send request
    app.logger.debug(`Deploying ${fileName}.${type}...`);
    const headers = {
      Accept: 'application/json',
    };
    let res: Response;
    try {
      if (action === 'add') {
        res = await agent
          .post('/cfs/save')
          .set(headers)
          .send({
            action,
            name: fileName,
            type,
            content: Buffer.from(fileCotent, 'utf-8').toString('base64'),
          });
      } else {
        res = await agent
          .post('/cfs/save')
          .set(headers)
          .send({
            id: fileInfo.id,
            action,
            name: fileInfo.name,
            type,
            content: Buffer.from(fileCotent, 'utf-8').toString('base64'),
          });
      }
    } catch (err) {
      app.logger.error(`Failed to upload configuration file "${fileInfo.name}": `, err.response?.body?.message || err);
      return reject(err);
    }
    if (!res || !res.body) {
      return reject(new Error('Cannot resolve the response from server.'));
    }
    if (!res.body.success) {
      return reject(new Error('Failed to save the content: ' + res.body.message));
    }
    // write id
    if (action === 'add') {
      const { id } = res.body.data;
      fileInfo.id = id;
    }
    resolve();
  });
};

const startDeployConfig = async (app: Application): Promise<void> => {
  let config: CFSDeployConfig;
  try {
    config = await getCFSDeployConfig(app.workDir);
  } catch (err) {
    app.logger.error(err.message || 'Failed to locate the config file.');
    return process.exit(-10521);
  }
  if (!config.deploy) {
    app.logger.error('Necessary deploy part is missing, please check your deploy config.');
    return process.exit(-10412);
  }
  if (!config.files || !Array.isArray(config.files)) {
    app.logger.error('Please set files information in the deploy configuration.');
    return process.exit(-10413);
  }
  try {
    await Promise.all(
      config.files.map((item) => {
        return deployConfig(app, item, config.deploy || {});
      })
    );
  } catch {
    app.logger.error('Failed to deploy configuration files.');
    return;
  }
  await writeCFSDeployConfig(config, app.workDir);
  app.logger.info('Configuration files have been deployed.');
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
  cmd
    .command('deploy')
    .description('Deploy the configuration to tigo server.')
    .action(async () => {
      await startDeployConfig(app);
    });
};

export default mount;
