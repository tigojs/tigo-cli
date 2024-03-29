import commander from 'commander';
import NpmApi from 'npm-api';
import child_process from 'child_process';
import path from 'path';
import fs from 'fs';
import inquirer from 'inquirer';
import { Application } from '../interface/application';
import { checkServerDir, getRuntimeConfig, getRuntimeConfigStatus, writeRuntimeConfig } from '../utils/env';
import { buildExternalScriptThis } from '../utils/external';

const npm = new NpmApi();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fetchPackageInfo = async (app: Application, prefix: string, moduleName: string): Promise<any> => {
  const repoName = `${prefix}${moduleName}`;
  const repo = npm.repo(repoName);
  app.logger.debug('Fetching package information from npm...');
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
      return process.exit(-10402);
    }
    app.logger.error('Cannot fetch necessary information about the package.');
    return process.exit(-10505);
  }
};

const installToServer = async (app: Application, moduleName: string): Promise<void> => {
  const rcStatus = getRuntimeConfigStatus(app.workDir);
  const rc = await getRuntimeConfig(rcStatus);
  if (!rc) {
    app.logger.error('Cannot find configuration file for tigo.');
    return process.exit(-10403);
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
  app.logger.debug(`Detected version v${version}.`);
  // run before install script
  if (pkg.tigo?.scripts?.beforeInstall) {
    const beforeInstallScriptPath = path.resolve(app.workDir, `./node_modules/${pkg.name}/${pkg.tigo.scripts.beforeInstall}`);
    if (fs.existsSync(beforeInstallScriptPath)) {
      const beforeInstall = (await import(beforeInstallScriptPath)).default;
      if (beforeInstall) {
        try {
          beforeInstall.call(buildExternalScriptThis(app, rcStatus, rc));
        } catch (err) {
          app.logger.error('Failed to execute before install script.', err);
          return process.exit(-10528);
        }
      }
    }
  }
  app.logger.debug('Start installing..');
  try {
    child_process.execSync(`npm install ${repoName}`, { stdio: 'inherit' });
  } catch {
    app.logger.error('Failed to install the package.');
    return process.exit(-10516);
  }
  app.logger.debug('Module package has been successfully installed.');
  // build config
  const { tigo } = pkg;
  if (tigo && tigo.type === 'lambda-package') {
    app.logger.info('Lambda package has added to your tigo server.');
    return;
  }
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
  // run post install script
  if (pkg.tigo?.scripts?.postInstall) {
    const postInstallScriptPath = path.resolve(app.workDir, `./node_modules/${pkg.name}/${pkg.tigo.scripts.postInstall}`);
    if (fs.existsSync(postInstallScriptPath)) {
      const postInstall = (await import(postInstallScriptPath)).default;
      if (postInstall) {
        try {
          await postInstall.call(buildExternalScriptThis(app, rcStatus, rc));
        } catch (err) {
          app.logger.error('Failed to execute the post install script.', err);
          return process.exit(-10527);
        }
      }
    }
  }
  app.logger.info('Module has added to your tigo server.');
};

const installToLambdaEnv = async (app: Application, moduleName: string): Promise<void> => {
  // fetch package info from npm
  const { pkg, repoName } = await fetchPackageInfo(app, '@tigojs/', moduleName);
  const { version } = pkg;
  app.logger.debug(`Detected version v${version}, start installing...`);
  try {
    child_process.execSync(`npm install ${repoName}`, { stdio: 'inherit' });
  } catch {
    app.logger.error('Failed to install the package.');
    return process.exit(-10517);
  }
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
          return process.exit(-10404);
        }
        await installToServer(app, moduleName);
      }
    });
};

export default mount;
