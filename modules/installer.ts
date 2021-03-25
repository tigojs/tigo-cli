import commander from 'commander';
import NpmApi from 'npm-api';
import child_process from 'child_process';
import path from 'path';
import fs from 'fs';
import { Application } from '../interface/application';
import { getRuntimeConfig, getRuntimeConfigStatus, writeRuntimeConfig } from '../utils/env';
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
    status: RuntimeConfigStatus,
    content: RuntimeConfig,
  }
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
  },
});

const mount = async (app: Application, program: commander.Command): Promise<void> => {
  program
    .command('add <name>')
    .description('Add official module to tigo server')
    .action(async (name) => {
      const rcStatus = await getRuntimeConfigStatus(app.workDir);
      const rc = await getRuntimeConfig(app.workDir, rcStatus);
      if (!rc) {
        app.logger.error('Cannot find configuration file for tigo.');
        process.exit(-10400);
      }
      if (!rc.plugins) {
        rc.plugins = {};
      }
      Object.keys(rc.plugins).forEach((key) => {
        const node = rc.plugins ? rc.plugins[key] : null;
        if (!node) {
          return;
        }
        if (node.package.replace('@tigojs/', '') === name) {
          app.logger.info('This module has already existed.');
        }
      });
      // fetch package info on npm
      const repoName = `@tigojs/${name}`;
      const repo = npm.repo(repoName);
      app.logger.info('Fetching package information from npm...');
      let pkg;
      try {
        pkg = await repo.package();
      } catch (err) {
        if (err.message === 'Not Found') {
          app.logger.error('This package does not exist, please check your input.');
          process.exit(-10400);
        }
        app.logger.error('Cannot fetch necessary information about the package.');
        process.exit(-10500);
      }
      // install module
      const { version } = pkg;
      app.logger.info(`Detected version ${version}, start installing...`);
      child_process.execSync(`npm install ${repoName}`, { stdio: 'inherit' });
      app.logger.info('Module installed.');
      // build config
      if (rc.plugins[name]) {
        rc.plugins[name].package = repoName;
      } else {
        rc.plugins[name] = {
          package: repoName,
        };
      }
      // write config
      if (rcStatus.js.exists) {
        try {
          fs.unlinkSync(rcStatus.js.path);
        } catch {
          app.logger.error('Failed to convert js runtime config to json format.');
          process.exit(-10500);
        }
      }
      writeRuntimeConfig(rcStatus, rc);
      if (pkg.tigo && pkg.tigo.postInstall) {
        // run post install script
        const postInstallScriptPath = path.resolve(app.workDir, `./node_modules/${pkg.name}/${pkg.tigo.postInstall}`);
        let postInstall;
        if (fs.existsSync(postInstallScriptPath)) {
          postInstall = await import(postInstallScriptPath);
        }
        await postInstall.bind(buildPostInstallThisArg(app, rcStatus, rc))();
      }
      app.logger.info('Module has added to your tigo server.');
    });
};

export default mount;
