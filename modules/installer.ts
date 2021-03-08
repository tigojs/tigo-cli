import commander from "commander";
import NpmApi from 'npm-api';
import child_process from 'child_process';
import fs from 'fs';
import { Application } from "../interface/application";
import { getRuntimeConfig, getRuntimeConfigStatus, writeRuntimeConfig } from "../utils/env";

const npm = new NpmApi();

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
      app.logger.info('Module has added to your tigo server, please set module config in .tigorc if necessary.')
    });
};

export default mount;
