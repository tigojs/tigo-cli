import path from 'path';
import fs from 'fs';
import commander from 'commander';
import child_process from 'child_process';
import NpmApi from 'npm-api';
import compareVersions from 'compare-versions';
import shelljs from 'shelljs';
import { Application } from '../interface/application';
import { checkServerDir } from '../utils/env';
import { downloadFrameworkPack, extractFrameworkPack } from '../utils/framework';
import { formatVersion } from '../utils/version';

const npm = new NpmApi();

const upgradeModule = async (app: Application, moduleName: string): Promise<void> => {
  const packageInfoPath = path.resolve(app.workDir, './package.json');
  if (!fs.existsSync(packageInfoPath)) {
    app.logger.error('Cannot find "package.json" in the current directory.');
    return process.exit(-10506);
  }
  const packageInfo = JSON.parse(fs.readFileSync(packageInfoPath, { encoding: 'utf-8' }));
  const dependencies = Object.keys(packageInfo.dependencies);
  const prefixedModuleName = `@tigojs/${moduleName}`;
  let prefixed = false;
  if (!dependencies.includes(prefixedModuleName)) {
    if (!dependencies.includes(moduleName)) {
      app.logger.error('The module may not be installed on the server, to install it, please use "tigo add".');
      return;
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
    return;
  }
  const { version } = pkg;
  const { version: localVersion } = packageInfo;
  if (compareVersions.compare(localVersion, version, '>=')) {
    app.logger.info('Module on the server is the latest version.');
    return;
  }
  try {
    child_process.execSync(`npm install ${packageName} --save`, { stdio: 'inherit' });
  } catch {
    app.logger.error('Failed to install the package.');
    return process.exit(-10518);
  }
  app.logger.info('Module has been upgraded.');
};

const upgradeFramework = async (app: Application): Promise<void> => {
  const packageInfoPath = path.resolve(app.workDir, './package.json');
  if (!fs.existsSync(packageInfoPath)) {
    app.logger.error('Cannot find "package.json" in the current directory.');
    return process.exit(-10507);
  }
  const packageInfo = JSON.parse(fs.readFileSync(packageInfoPath, { encoding: 'utf-8' }));
  const repo = npm.repo('tigo');
  let remoteInfo;
  try {
    remoteInfo = await repo.package();
  } catch (err) {
    app.logger.error('Cannot fetch package info from npm.', err.message || err);
    return;
  }
  const { version: localVersion } = packageInfo;
  const { version: remoteVersion } = remoteInfo;
  app.logger.debug(`Detected the latest version v${remoteVersion} on npm.`);
  if (compareVersions.compare(localVersion, remoteVersion, '>=')) {
    app.logger.info('Server framework is the latest version.');
    return;
  }
  // download the server pkg
  const { packPath } = await downloadFrameworkPack(app, remoteInfo);
  const extractTargetDir = path.resolve(app.tempDir, `./server_${remoteVersion}`);
  if (!fs.existsSync(extractTargetDir)) {
    fs.mkdirSync(extractTargetDir, { recursive: true });
  }
  await extractFrameworkPack({ app, packPath, targetPath: extractTargetDir });
  const moveFiles = (sources) => {
    return new Promise<void>((resolve) => {
      sources.forEach((src) => {
        if (shelljs.mv(path.resolve(extractTargetDir, `./package/${src}`), app.workDir).code !== 0) {
          app.logger.error('Unable to overwrite the server files.');
          return process.exit(-10511);
        }
      });
      resolve();
    });
  };
  // move files
  await moveFiles(['server.js', 'src/*', 'scripts/*']);
  app.logger.debug('Files are upgraded, starting to process the dependencies...');
  // check dependencies
  const { dependencies, devDependencies } = remoteInfo;
  const dependencyPackages = Object.keys(dependencies);
  const devDependencyPackages = Object.keys(devDependencies);
  dependencyPackages.forEach((pkgName) => {
    if (packageInfo.dependencies[pkgName]) {
      if (compareVersions.compare(formatVersion(remoteInfo.dependencies[pkgName]), formatVersion(packageInfo.dependencies[pkgName]), '>')) {
        app.logger.debug(`Starting to install ${pkgName}...`);
        try {
          child_process.execSync(`npm install ${pkgName}@latest --save`, { stdio: 'inherit' });
        } catch {
          app.logger.error('Failed to install the new package.');
          return process.exit(-10519);
        }
      }
    } else {
      app.logger.debug(`Starting to install ${pkgName}...`);
      try {
        child_process.execSync(`npm install ${pkgName}@latest --save`, { stdio: 'inherit' });
      } catch {
        app.logger.error('Failed to install the new package.');
        return process.exit(-10519);
      }
    }
  });
  devDependencyPackages.forEach((pkgName) => {
    if (packageInfo.devDependencies[pkgName]) {
      if (compareVersions.compare(formatVersion(remoteInfo.devDependencies[pkgName]), formatVersion(packageInfo.devDependencies[pkgName]), '>')) {
        app.logger.debug(`Starting to install ${pkgName}...`);
        try {
          child_process.execSync(`npm install ${pkgName}@latest --save-dev`, { stdio: 'inherit' });
        } catch {
          app.logger.error('Failed to install the new package.');
          return process.exit(-10519);
        }
      }
    } else {
      app.logger.debug(`Starting to install ${pkgName}...`);
      try {
        child_process.execSync(`npm install ${pkgName}@latest --save-dev`, { stdio: 'inherit' });
      } catch {
        app.logger.error('Failed to install the new package.');
        return process.exit(-10519);
      }
    }
  });
  // modify the package.json
  app.logger.debug('Starting to update package.json...');
  const afterInstalled = JSON.parse(fs.readFileSync(packageInfoPath, { encoding: 'utf-8' }));
  afterInstalled.version = remoteInfo.version;
  if (remoteInfo.engines) {
    afterInstalled.engines = remoteInfo.engines;
  }
  fs.writeFileSync(packageInfoPath, JSON.stringify(afterInstalled, null, '  '), { encoding: 'utf-8' });
  app.logger.info('Framework has been upgraded.');
};

const mount = (app: Application, program: commander.Command): void => {
  program
    .command('upgrade <module>')
    .description('Upgrade an installed module or the framework.')
    .action(async (moduleName: string) => {
      if (!checkServerDir(app.workDir)) {
        app.logger.error('tigo server cannot be detected in the current folder.');
        return process.exit(-10405);
      }
      if (moduleName === 'framework') {
        if (!checkServerDir(app.workDir)) {
          app.logger.error('tigo server cannot be detected in the current folder.');
          return process.exit(-10406);
        }
        await upgradeFramework(app);
      } else {
        await upgradeModule(app, moduleName);
      }
    });
};

export default mount;
