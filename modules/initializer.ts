import commander from 'commander';
import path from 'path';
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
import { getRepoLatestRelease } from '../utils/github';
import { GitHubReleaseInfo } from '../interface/github';
import { downloadFileWithProgress } from '../utils/network';
import { extractTgz } from '../utils/pack';
import { isSpdxLicenseId } from '../utils/spdx';
import { ProjectInfo } from '../interface/project';

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
  // ask user giving necessary info
  app.logger.info('We need some necessary info about your tigo lambda project:');
  const projectInfo: ProjectInfo = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Project name: ',
      validate: (v) => {
        if (!v) {
          return 'Project name cannot be empty.';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'author',
      message: 'Author: ',
    },
    {
      type: 'input',
      name: 'license',
      message: 'License: ',
      default: 'MIT',
      validate: (v) => {
        if (!isSpdxLicenseId(v)) {
          return 'Cannot find this license in SPDX license list.';
        }
        return true;
      },
    },
  ]);
  // fetch latest release
  let latestRelease: GitHubReleaseInfo | undefined;
  try {
    latestRelease = await getRepoLatestRelease('tigojs/tigo-lambda-devenv');
  } catch (err) {
    app.logger.error('Cannot fetch the latest release.');
    return process.exit(-10529);
  }
  if (!latestRelease || !latestRelease.downloadUrl || !latestRelease.tagName) {
    app.logger.error('Cannot fetch the latest release.');
    return process.exit(-10529);
  }
  const { tagName: releaseVer } = latestRelease;
  app.logger.info(`Found latest version ${releaseVer}.`);
  // download and extract the latest release
  const tempSavePath = path.resolve(app.tempDir, `./devenv_${releaseVer}.tgz`);
  try {
    await downloadFileWithProgress(latestRelease.downloadUrl, tempSavePath, 'Downloading the latest release of lambda development environment... [{bar}] {percentage}%');
  } catch (err) {
    app.logger.error('Failed to download the latest release.', err.message || err);
    return process.exit(-10525);
  }
  try {
    await extractTgz(tempSavePath, app.workDir);
  } catch (err) {
    app.logger.error('Failed to extract the latest release of lambda development environment.', err.message || err);
    return process.exit(-10526);
  }
  // check .github directory, if exists, remove it
  const githubDir = path.resolve(app.workDir, './.github');
  if (fs.existsSync(githubDir)) {
    const delRet = shelljs.rm('-rf', './.github');
    if (delRet.code !== 0) {
      app.logger.warn('Cannot remove .github folder automatically.');
    }
  }
  // process package.json
  const packageInfoPath = path.resolve(app.workDir, './package.json');
  if (fs.existsSync(packageInfoPath)) {
    try {
      const packageInfo = JSON.parse(fs.readFileSync(packageInfoPath, { encoding: 'utf-8' }));
      Object.assign(packageInfo, projectInfo);
      const originalVersion = packageInfo.version;
      packageInfo.version = '1.0.0';
      if (!packageInfo.tigo) {
        packageInfo.tigo = {};
      }
      if (!packageInfo.tigo.devenv) {
        packageInfo.tigo.devenv = {
          version: originalVersion,
        };
      }
      fs.writeFileSync(packageInfoPath, JSON.stringify(packageInfo, null, '  '), { encoding: 'utf-8' });
    } catch (err) {
      app.logger.warn('Failed to modify package.json.', err);
    }
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
  const devConfig = getDevConfig(app);
  if (!devConfig.content) {
    devConfig.content = {};
  }
  const { access_key: accessKey, secret_key: secretKey } = config;
  if (!devConfig.content.deploy) {
    devConfig.content.deploy = {};
  }
  if (accessKey && secretKey) {
    Object.assign(devConfig.content.deploy, {
      accessKey,
      secretKey,
    });
  }
  if (config.api_host) {
    const host = parseHost(config.api_host);
    if (!host.port) {
      host.port = host.https ? 443 : 80;
    }
    Object.assign(devConfig.content.deploy, host);
  }
  if (config.server_internal_base) {
    Object.assign(devConfig.content.deploy, {
      base: config.server_internal_base,
    });
  }
  // ask the port
  app.logger.info('The lambda dev environment is almost ready, we need you to provide more information to configure it.');
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
      default: true,
      name: 'kv',
    },
    {
      type: 'confirm',
      message: 'Do you want to enable OSS Mock?',
      default: true,
      name: 'oss',
    },
    {
      type: 'confirm',
      message: 'Do you want to enable CFS Mock?',
      default: true,
      name: 'cfs',
    },
  ]);
  // set up devServer part
  if (!devConfig.content.devServer) {
    devConfig.content.devServer = {
      port: 9292,
      maxFileSize: 104857600,
    };
  }
  Object.assign(devConfig.content.devServer, {
    port: answer.port,
  });
  // set up lambda part
  if (!devConfig.content.lambda) {
    devConfig.content.lambda = {
      allowedRequire: [],
      allowBuiltin: false,
      allowedBuiltin: [],
      env: {},
    };
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
  // ask for init git repo
  const gitStatus = checkGit();
  if (gitStatus.installed) {
    const gitAnswer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'init',
        message: 'Do you want to init a git repository?',
        default: true,
      },
    ]);
    if (gitAnswer.init) {
      shelljs.exec('git init', { silent: true });
      const commitAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'message',
          message: 'First commit message: ',
          default: 'Initialized tigo lambda dev environment.',
          validate: (v) => {
            if (!v) {
              return 'Commit message cannot be empty';
            }
            return true;
          }
        }
      ]);
      shelljs.exec('git add .');
      shelljs.exec(`git commit -m "${commitAnswer.message}"`);
    }
  }
  // set up rollup part
  if (!devConfig.content.rollup) {
    devConfig.content.rollup = {
      output: './dist/bundled.js',
    };
  }
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
