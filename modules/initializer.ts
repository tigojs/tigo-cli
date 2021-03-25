import commander from 'commander';
import NpmApi from 'npm-api';
import request from 'superagent';
import path from 'path';
import fs from 'fs';
import progress from 'cli-progress';
import chalk from 'chalk';
import shelljs from 'shelljs';
import child_process from 'child_process';
import inquirer from 'inquirer';
import { Application } from '../interface/application';
import { writeFileFromReq } from '../utils/network';
import { getFileShaSum } from '../utils/hash';
import { extractTgz } from '../utils/pack';
import { checkGit, getRuntimeConfigStatus, writeRuntimeConfig } from '../utils/env';
import { RuntimeConfig } from '../interface/rc';
import { getConfig } from '../utils/config';

const npm = new NpmApi();

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

const extractServerPack = async (app: Application, packPath: string): Promise<void> => {
  app.logger.info('Starting to extract the package...');
  await extractTgz(packPath, app.workDir);
  // extracted things are under a dir named package
  const { code: mvCode } = shelljs.mv('./package/*', './');
  if (mvCode !== 0) {
    app.logger.error('Move server files failed.');
    process.exit(-10500);
  }
  const { code: rmCode } = shelljs.rm('-rf', './package');
  if (rmCode !== 0) {
    app.logger.error('Remove temp folder failed.');
    process.exit(-10500);
  }
  // run npm install
  app.logger.info('Package extracted, starting to install dependencies...');
  try {
    child_process.execSync('npm install', { stdio: 'inherit' });
  } catch {
    app.logger.error('Fail to install the dependecies of tigo server.');
  }
  await initializeServerConfig(app);
  app.logger.info('All things done, your tigo server is ready.');
};

const downloadServerPack = async (app: Application): Promise<void> => {
  const repo = npm.repo('tigo');
  let pkg;
  try {
    pkg = await repo.package();
  } catch (err) {
    app.logger.error('Fetching server package failed.', err.mesage || err);
    process.exit(-10500);
  }
  const { tarball, shasum } = pkg.dist;
  app.logger.info('Server package founded on npm.');
  const tempSavePath = path.resolve(app.tempDir, './server.tgz');
  // check exists pack
  if (fs.existsSync(tempSavePath)) {
    const localTempHash = await getFileShaSum(tempSavePath);
    if (shasum === localTempHash) {
      app.logger.info('Detected usable cached package, skip downloading.');
      extractServerPack(app, tempSavePath);
      return;
    }
  }
  // download package
  app.logger.info('Starting to download the package.');
  const bar = new progress.SingleBar({
    format: chalk.hex('#f16d41')('Downloading server package... [{bar}] {percentage}%'),
    hideCursor: true,
  });
  const req = request.get(tarball);
  bar.start(100, 0);
  req.on('progress', (e) => {
    bar.update(e.percent || 0);
  });
  try {
    await writeFileFromReq(req, tempSavePath);
  } catch (err) {
    app.logger.error('Saving package failed.', err.message || err);
    process.exit(-10500);
  }
  bar.update(bar.getTotal());
  bar.stop();
  // check sum
  const downloadedShaSum = await getFileShaSum(tempSavePath);
  if (downloadedShaSum !== shasum) {
    app.logger.error('Package hash mismatch.');
    process.exit(-10500);
  }
  extractServerPack(app, tempSavePath);
};

const initializeLambdaEnv = async (app: Application) => {
  const gitStatus = checkGit();
  if (!gitStatus.installed) {
    app.logger.error('Git is not installed, please install git first.');
    process.exit(-10400);
  }
  // clone repo
  app.logger.info('Downloading repository...');
  child_process.execSync('git clone -b main https://github.com/tigojs/tigo-lambda-template.git --depth 1', { stdio: 'inherit' });
  app.logger.info('Repository downloaded.');
  const { code: mvCode } = shelljs.mv('./tigo-lambda-template/*', './tigo-lambda-template/.*', './');
  if (mvCode !== 0) {
    app.logger.error('Cannot move repository files.');
    process.exit(-10500);
  }
  const { code: rmCode } = shelljs.rm('-rf', './tigo-lambda-template');
  if (rmCode !== 0) {
    app.logger.error('Remove temp folder failed.');
    process.exit(-10500);
  }
  // install dependencies
  app.logger.info('Start installing dependencies...');
  child_process.execSync('npm install', { stdio: 'inherit' });
  app.logger.info('Dependencies installed.');
  // init dev env config
  const config = getConfig();
  if (config && config.api_access_key && config.api_secret_key) {
    const { api_access_key: ak, api_secret_key: sk } = config;
    const devConfigPath = path.resolve(app.workDir, './.tigodev.json');
    let devConfig;
    if (fs.existsSync(devConfigPath)) {
      try {
        devConfig = JSON.parse(fs.readFileSync(devConfigPath, { encoding: 'utf-8' }));
      } catch {
        app.logger.error('Cannot read dev environment configuration.');
      }
    }
    devConfig = devConfig || {};
    devConfig.upload = devConfig.upload || {};
    Object.assign(devConfig.upload, {
      accessKey: ak,
      secretKey: sk,
    });
    try {
      fs.writeFileSync(devConfigPath, JSON.stringify(devConfig, null, '  '), { encoding: 'utf-8' });
      app.logger.info('Dev environment configuration initialized.');
    } catch {
      app.logger.error('Cannot write dev environment configuration.');
    }
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
    .description('initialize project by using tigo templates (server, lambda)')
    .action(async (type: string) => {
      // check work dir
      if (type === 'server') {
        await checkWorkDir(app.workDir);
        await downloadServerPack(app);
      } else if (type === 'server-config') {
        await initializeServerConfig(app);
      } else if (type === 'lambda') {
        await checkWorkDir(app.workDir);
        await initializeLambdaEnv(app);
      } else {
        app.logger.error('You should specific a type to initialize.');
        program.help();
      }
    });
};

export default mount;
