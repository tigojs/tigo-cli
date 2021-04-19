import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import commander from 'commander';
import child_process from 'child_process';
import NpmApi from 'npm-api';
import compareVersions from 'compare-versions';
import shelljs from 'shelljs';
import inquirer from 'inquirer';
import chalk from 'chalk';
import table from 'text-table';
import { Application } from '../interface/application';
import { checkServerDir } from '../utils/env';
import { downloadFrameworkPack, extractFrameworkPack } from '../utils/framework';
import { formatVersion } from '../utils/version';

interface DependencyInfo {
  name: string;
  version: string;
  remoteVersion?: string;
}

interface Choice {
  name: Array<string>;
  short: string;
  value: string;
}

interface FormattedChoice {
  name: string;
  short: string;
  value: string;
}

const IGNORE_LIST = ['@tigojs/utils', '@tigojs/core'];
const IGNORE_ROOT_FILES = ['.tigorc.json', '.tigorc.js', 'package.json', 'package-lock.json'];

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

const collectRootFiles = async (rootDir: string): Promise<Array<Array<string>>> => {
  const packageDir = path.resolve(rootDir, './package');
  const dirFiles = await fsp.readdir(packageDir);
  const collection: Array<Array<string>> = [];
  await Promise.all(dirFiles.map(async (filename) => {
    return new Promise<void>(async (resolve) => {
      const filePath = path.resolve(packageDir, filename);
      const stat = await fsp.stat(filePath);
      if (stat.isDirectory()) {
        return resolve();
      }
      if (IGNORE_ROOT_FILES.includes(filename)) {
        return resolve();
      }
      collection.push([filename, './']);
      resolve();
    });
  }));
  return collection;
};

const upgradeFramework = async (app: Application): Promise<void> => {
  const packageInfoPath = path.resolve(app.workDir, './package.json');
  if (!fs.existsSync(packageInfoPath)) {
    app.logger.error('Cannot find "package.json" in the current directory.');
    return process.exit(-10507);
  }
  const packageInfo = JSON.parse(await fsp.readFile(packageInfoPath, { encoding: 'utf-8' }));
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
        if (shelljs.cp('-rf', path.resolve(extractTargetDir, `./package/${src[0]}`), path.resolve(app.workDir, `./${src[1]}`)).code !== 0) {
          app.logger.error('Unable to overwrite the server files.');
          return process.exit(-10511);
        }
      });
      resolve();
    });
  };
  // move files
  const toMove = [['src/*', 'src'], ['scripts/*', 'scripts']].concat(await collectRootFiles(extractTargetDir));
  await moveFiles(toMove);
  // try to remove tempdir
  if (shelljs.rm('-rf', extractTargetDir).code !== 0) {
    app.logger.warn('Failed to remove temp folder.');
  }
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
  if (remoteInfo.scripts) {
    afterInstalled.scripts = remoteInfo.scripts;
  }
  fs.writeFileSync(packageInfoPath, JSON.stringify(afterInstalled, null, '  '), { encoding: 'utf-8' });
  app.logger.info('Framework has been upgraded.');
};

const checkUpdates = async (app: Application): Promise<void> => {
  const packageInfoPath = path.resolve(app.workDir, './package.json');
  if (!fs.existsSync(packageInfoPath)) {
    app.logger.error('Cannot find "package.json" in the current directory.');
    return process.exit(-10506);
  }
  const packageInfo = JSON.parse(fs.readFileSync(packageInfoPath, { encoding: 'utf-8' }));
  const dependencies = Object.keys(packageInfo.dependencies);
  const officials = <Array<DependencyInfo>>[];
  dependencies.forEach((dependency) => {
    if (dependency.startsWith('@tigojs/') && !IGNORE_LIST.includes(dependency)) {
      officials.push({
        name: dependency,
        version: formatVersion(packageInfo.dependencies[dependency]),
      });
    }
  });
  if (!officials.length) {
    app.logger.error('Cannot find any installed official modules.');
    return process.exit(-10408);
  }
  await Promise.all(
    officials.map((pkg, index) => {
      return new Promise<void>(async (resolve, reject) => {
        const repo = npm.repo(pkg.name);
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pkg = <any>await repo.package();
          officials[index].remoteVersion = formatVersion(pkg.version);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    })
  );
  // display update info
  const choices = officials
    .map((pkg) => {
      if (!pkg.remoteVersion) {
        return null;
      }
      if (compareVersions.compare(pkg.remoteVersion, pkg.version, '<=')) {
        return null;
      }
      return {
        name: [pkg.name, chalk.cyanBright(pkg.version), chalk.white('❯'), chalk.green(chalk.bold(pkg.remoteVersion))],
        short: pkg.name,
        value: <string>pkg.name,
      };
    })
    .filter((item) => !!item) as Array<Choice>;
  if (!choices.length) {
    app.logger.info("The official packages you've installed are all up-to-date.");
    return;
  }
  const names = table(choices.map((item) => item.name)).split('\n');
  const answer = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selected',
      message: 'Select the packages you want to upgrade:',
      choices: choices.map((item) => {
        return {
          name: names.shift(),
          short: item.short,
          value: item.value,
        } as FormattedChoice;
      }),
      pageSize: process.stdout.rows - 2,
    },
  ]);
  if (!answer.selected.length) {
    app.logger.warn('You have not selected any packages, the program has exited.');
    return;
  }
  app.logger.debug('Starting to install the latest version...');
  try {
    child_process.execSync(`npm install ${answer.selected.map((p: string) => `${p}@latest`).join(' ')} --save`, { stdio: 'inherit' });
  } catch {
    app.logger.error('Failed to install the new modules.');
    return;
  }
  app.logger.info('Modules has been upgraded.');
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
  program
    .command('check-updates')
    .description('Check the updates for installed official modules.')
    .action(async () => {
      app.logger.debug('Starting to check updates...');
      await checkUpdates(app);
    });
};

export default mount;
