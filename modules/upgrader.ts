import path from 'path';
import fs from 'fs';
import commander from 'commander';
import child_process from 'child_process';
import NpmApi from 'npm-api';
import compareVersions from 'compare-versions';
import { Application } from '../interface/application';
import { checkServerDir } from '../utils/env';

const npm = new NpmApi();

const upgradeModule = async (app: Application, moduleName: string): Promise<void> => {
  const packageInfoPath = path.resolve(app.workDir, './package.json');
  if (!fs.existsSync(packageInfoPath)) {
    app.logger.error('Cannot find "package.json" in the current directory.');
    return process.exit(-10500);
  }
  const packageInfo = JSON.parse(fs.readFileSync(packageInfoPath, { encoding: 'utf-8' }));
  const dependencies = Object.keys(packageInfo.dependencies);
  const prefixedModuleName = `@tigojs/${moduleName}`;
  let prefixed = false;
  if (!dependencies.includes(prefixedModuleName)) {
    if (!dependencies.includes(moduleName)) {
      app.logger.error('The module may not be installed on the server, to install it, please use "tigo add".');
      return process.exit(-10400);
    }
  } else {
    prefixed = true;
  }
  const packageName = prefixed ? prefixedModuleName : moduleName;
  // check remote version
  const repo = npm.repo(packageName);
  let pkg;
  try {
    pkg = await repo.package();
  } catch (err) {
    app.logger.error('Cannot fetch package info from npm.', err.message || err);
  }
  const { version } = pkg;
  const { version: localVersion } = packageInfo;
  if (compareVersions.compare(localVersion, version, '>=')) {
    app.logger.info('Module on the server is the latest version.');
    return;
  }
  child_process.execSync(`npm install ${packageName} --save`, { stdio: 'inherit' });
  app.logger.info('Module has been upgraded.');
};

const mount = (app: Application, program: commander.Command): void => {
  program
    .command('upgrade <module>')
    .description('Upgrade an installed module.')
    .action(async (moduleName: string) => {
      if (!checkServerDir(app.workDir)) {
        app.logger.error('tigo server cannot be detected in the current folder.');
        return process.exit(-10400);
      }
      await upgradeModule(app, moduleName);
    });
};

export default mount;
