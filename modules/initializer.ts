import commander from 'commander';
import fs from 'fs';
import shelljs from 'shelljs';
import child_process from 'child_process';
import inquirer from 'inquirer';
import { Application } from '../interface/application';
import { checkGit, getDevConfig, getRuntimeConfigStatus, writeRuntimeConfig } from '../utils/env';
import { RuntimeConfig } from '../interface/rc';
import { getConfig, updateConfigItem } from '../utils/config';
import { parseHost } from '../utils/host';
import { downloadFrameworkPack, extractFrameworkPack } from '../utils/framework';

const initializeServerConfig = async (app: Application): Promise<void> => {
  const status = getRuntimeConfigStatus(app.workDir);
  if (status.exists) {
    const answer = await inquirer.prompt([{ type: 'confirm', message: 'Detected a tigo runtime config, overwrite it?', default: false, name: 'overwrite' }]);
    if (!answer.overwrite) {
      return;
    }
  }
  const answers = await inquirer.prompt([
    {
      type: 'number',
      name: 'port',
      message: 'Which port do you want the server to listen on?',
      default: 8000,
      validate: (port) => {
        if (port <= 0 || port > 65535) {
          return 'Port is invalid.';
        }
        return true;
      },
    },
  ]);
  const rc: RuntimeConfig = {
    server: {
      port: answers.port,
    },
  };
  // write config
  writeRuntimeConfig(status, rc);
  app.logger.info('Runtime config initialized.');
};

const initializeLambdaEnv = async (app: Application) => {
  const gitStatus = checkGit();
  if (!gitStatus.installed) {
    app.logger.error('Git is not installed, please install git first.');
    return process.exit(-10401);
  }
  // clone repo
  app.logger.debug('Downloading repository...');
  try {
    child_process.execSync('git clone -b main https://github.com/tigojs/tigo-lambda-template.git --depth 1', { stdio: 'inherit' });
  } catch {
    app.logger.error('Failed to clone the repository.');
    return process.exit(-10514);
  }
  app.logger.info('Repository downloaded.');
  if (shelljs.cp('-rf', ['./tigo-lambda-template/*', './tigo-lambda-template/.*'], './').code !== 0) {
    app.logger.error('Cannot move repository files.');
    return process.exit(-10501);
  }
  if (shelljs.rm('-rf', './tigo-lambda-template').code !== 0) {
    app.logger.warn('Failed to remove temp folder.');
  }
  // install dependencies
  app.logger.debug('Start installing dependencies...');
  try {
    child_process.execSync('npm install', { stdio: 'inherit' });
  } catch {
    app.logger.error('Failed to install the dependencies.');
    return process.exit(-10515);
  }
  app.logger.info('Dependencies installed.');
  // init dev env config
  const config = getConfig() || {};
  let devConfig = getDevConfig(app) || {};
  devConfig = devConfig || {};
  const { access_key: ak, secret_key: sk } = config;
  if (!devConfig.content.deploy) {
    devConfig.content.deploy = {};
  }
  if (config.access_key && config.secret_key) {
    Object.assign(devConfig.content.deploy, {
      accessKey: ak,
      secretKey: sk,
    });
  }
  if (config.host) {
    const host = parseHost(config.host);
    Object.assign(devConfig.content.deploy, host);
  }
  // ask the port
  const answer = await inquirer.prompt([
    {
      type: 'number',
      message: 'Which port you want to the dev server to listen on?',
      default: 9292,
      name: 'port',
      validate: (value) => {
        if (value <= 0 || value > 65535) {
          return 'The input is invalid, please retry.';
        }
        return true;
      },
    },
    {
      type: 'confirm',
      message: 'Do you want to enable Lambda KV Storage?',
      default: false,
      name: 'kv',
    },
    {
      type: 'confirm',
      message: 'Do you want to enable OSS Mock?',
      default: false,
      name: 'oss',
    },
    {
      type: 'confirm',
      message: 'Do you want to enable CFS Mock?',
      default: false,
      name: 'cfs',
    },
  ]);
  // set up devServer part
  if (!devConfig.content.devServer) {
    devConfig.content.devServer = {};
  }
  Object.assign(devConfig.content.devServer, {
    port: answer.port,
  });
  // set up lambda part
  if (!devConfig.content.lambda) {
    devConfig.content.lambda = {};
  }
  Object.assign(devConfig.content.lambda, {
    cfs: {
      enable: answer.cfs,
    },
    oss: {
      enable: answer.oss,
    },
    kv: {
      enable: answer.kv,
    },
  });
  // write config file
  try {
    fs.writeFileSync(devConfig.path, JSON.stringify(devConfig.content, null, '  '), { encoding: 'utf-8' });
    app.logger.info('Dev environment configuration initialized.');
  } catch {
    app.logger.error('Cannot write dev environment configuration.');
  }
  app.logger.info('Lambda dev environment is ready, now you can develope your own function.');
};

const checkWorkDir = async (workDir: string): Promise<boolean> => {
  const dir = fs.readdirSync(workDir);
  if (dir?.length > 0) {
    const answers = await inquirer.prompt([{ type: 'confirm', name: 'continue', message: 'Current folder is not empty, continue initializing?', default: false }]);
    if (!answers.continue) {
      return false;
    }
  }
  return true;
};

const mount = (app: Application, program: commander.Command): void => {
  program
    .command('init <template>')
    .description('Initialize project by using tigo templates (server, lambda)')
    .action(async (type: string) => {
      if (!(await checkWorkDir(app.workDir))) {
        return;
      }
      // check work dir
      if (type === 'server') {
        const { packPath } = await downloadFrameworkPack(app);
        await extractFrameworkPack({
          app,
          packPath,
          targetPath: app.workDir,
        });
        if (shelljs.cp('-rf', './package/*', './').code !== 0) {
          app.logger.error('Move server files failed.');
          return process.exit(-10503);
        }
        if (shelljs.rm('-rf', './package').code !== 0) {
          app.logger.warn('Failed to remove temp folder.');
        }
        // run npm install
        app.logger.info('Package extracted, starting to install dependencies...');
        try {
          child_process.execSync('npm install', { stdio: 'inherit' });
        } catch {
          app.logger.error('Fail to install the dependecies of tigo server.');
          return process.exit(-10513);
        }
        app.logger.info('Dependencies installed.');
        await initializeServerConfig(app);
        // save tigo server dir to cli config
        updateConfigItem('server_dir', app.workDir);
        app.logger.info('Server directory record in cli config hass been updated.');
        app.logger.info('All things done, your tigo server is ready.');
      } else if (type === 'server-config') {
        await initializeServerConfig(app);
      } else if (type === 'lambda') {
        await initializeLambdaEnv(app);
      } else {
        app.logger.error('You should specific a type to initialize.');
        program.help();
      }
    });
};

export default mount;
