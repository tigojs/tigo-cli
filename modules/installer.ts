import commander from 'commander';
import NpmApi from 'npm-api';
import child_process from 'child_process';
import path from 'path';
import fs from 'fs';
import { Application } from '../interface/application';
import { checkServerDir, getRuntimeConfig, getRuntimeConfigStatus, writeRuntimeConfig } from '../utils/env';
import inquirer from 'inquirer';
import shelljs from 'shelljs';
import { Logger } from 'log4js';
import { RuntimeConfig, RuntimeConfigStatus } from '../interface/rc';

const npm = new NpmApi();

interface postInstallThis {
  inquirer: typeof inquirer;
  npm: typeof npm;
  workDir: string;
  shell: typeof shelljs;
  logger: Logger;
  rc: {
    status: RuntimeConfigStatus;
    content: RuntimeConfig;
    write: (status: RuntimeConfigStatus, rc: RuntimeConfig) => void;
  };
}

const buildPostInstallThisArg = (app: Application, rcStatus: RuntimeConfigStatus, rc: RuntimeConfig): postInstallThis => ({
  inquirer,
  workDir: app.workDir,
  npm,
  shell: shelljs,
  logger: app.logger,
  rc: {
    status: rcStatus,
    content: rc,
    write: writeRuntimeConfig,
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fetchPackageInfo = async (app: Application, prefix: string, moduleName: string): Promise<any> => {
  const repoName = `${prefix}${moduleName}`;
  const repo = npm.repo(repoName);
  app.logger.info('Fetching package information from npm...');
  let pkg;
  try {
    pkg = await repo.package();
    return { repoName, pkg };
  } catch (err) {
    if (err.message === 'Not Found') {
      if (prefix) {
        return await fetchPackageInfo(app, '', moduleName);
      }
      app.logger.error('This package does not exist, please check your input.');
      return process.exit(-10400);
    }
    app.logger.error('Cannot fetch necessary information about the package.');
    return process.exit(-10500);
  }
};

const installToServer = async (app: Application, moduleName: string): Promise<void> => {
  const rcStatus = await getRuntimeConfigStatus(app.workDir);
  const rc = await getRuntimeConfig(rcStatus);
  if (!rc) {
    app.logger.error('Cannot find configuration file for tigo.');
    return process.exit(-10400);
  }
  if (!rc.plugins) {
    rc.plugins = {};
  }
  const { plugins } = rc;
  const pluginNames = Object.keys(plugins);
  for (const key of pluginNames) {
    const node = rc.plugins ? rc.plugins[key] : null;
    if (!node) {
      return;
    }
    if (node.package.replace('@tigojs/', '') === moduleName) {
      app.logger.warn('This module has already existed.');
      const answers = await inquirer.prompt({
        type: 'confirm',
        name: 'still',
        message: 'Do you still want to install it even the module already existed?',
        default: false,
      });
      if (!answers.still) {
        return;
      }
    }
  }
  // fetch package info from npm
  const { pkg, repoName } = await fetchPackageInfo(app, '@tigojs/', moduleName);
  // install module
  const { version } = pkg;
  app.logger.info(`Detected version v${version}, start installing...`);
  child_process.execSync(`npm install ${repoName}`, { stdio: 'inherit' });
  app.logger.info('Module installed.');
  // build config
  if (rc.plugins[moduleName]) {
    rc.plugins[moduleName].package = repoName;
  } else {
    rc.plugins[moduleName] = {
      package: repoName,
    };
  }
  // write config
  writeRuntimeConfig(rcStatus, rc);
  if (pkg.tigo && pkg.tigo.scripts && pkg.tigo.scripts.postInstall) {
    // run post install script
    const postInstallScriptPath = path.resolve(app.workDir, `./node_modules/${pkg.name}/${pkg.tigo.scripts.postInstall}`);
    if (fs.existsSync(postInstallScriptPath)) {
      const postInstall = (await import(postInstallScriptPath)).default;
      if (postInstall) {
        await postInstall.call(buildPostInstallThisArg(app, rcStatus, rc));
      }
    }
  }
  app.logger.info('Module has added to your tigo server.');
};

const installToLambdaEnv = async (app: Application, moduleName: string): Promise<void> => {
  // fetch package info from npm
  const { pkg, repoName } = await fetchPackageInfo(app, '@tigojs/', moduleName);
  const { version } = pkg;
  app.logger.info(`Detected version v${version}, start installing...`);
  child_process.execSync(`npm install ${repoName}`, { stdio: 'inherit' });
  app.logger.info(`Lambda package [${repoName}] has been installed successfully.`);
};

const mount = async (app: Application, program: commander.Command): Promise<void> => {
  program
    .command('add <moduleName>')
    .alias('install')
    .description('Add official module to tigo server')
    .action(async (moduleName: string) => {
      // env check
      if (fs.existsSync(path.resolve(app.workDir, './.tigodev.json'))) {
        // lambda dev env
        await installToLambdaEnv(app, moduleName);
      } else {
        // server
        if (!checkServerDir(app.workDir)) {
          app.logger.error('tigo server cannot be detected in the current folder.');
          return process.exit(-10400);
        }
        await installToServer(app, moduleName);
      }
    });
};

export default mount;
