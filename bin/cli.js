#!/usr/bin/env node
'use strict';

var commander = require('commander');
var chalk = require('chalk');
var NpmApi = require('npm-api');
var request = require('superagent');
var path = require('path');
var fs = require('fs');
var progress = require('cli-progress');
var shelljs = require('shelljs');
var child_process = require('child_process');
var inquirer = require('inquirer');
var ssri = require('ssri');
var tar = require('tar-fs');
var gunzip = require('gunzip-maybe');
var log4js = require('log4js');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var commander__default = /*#__PURE__*/_interopDefaultLegacy(commander);
var chalk__default = /*#__PURE__*/_interopDefaultLegacy(chalk);
var NpmApi__default = /*#__PURE__*/_interopDefaultLegacy(NpmApi);
var request__default = /*#__PURE__*/_interopDefaultLegacy(request);
var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);
var progress__default = /*#__PURE__*/_interopDefaultLegacy(progress);
var shelljs__default = /*#__PURE__*/_interopDefaultLegacy(shelljs);
var child_process__default = /*#__PURE__*/_interopDefaultLegacy(child_process);
var inquirer__default = /*#__PURE__*/_interopDefaultLegacy(inquirer);
var ssri__default = /*#__PURE__*/_interopDefaultLegacy(ssri);
var tar__default = /*#__PURE__*/_interopDefaultLegacy(tar);
var gunzip__default = /*#__PURE__*/_interopDefaultLegacy(gunzip);
var log4js__default = /*#__PURE__*/_interopDefaultLegacy(log4js);

const writeFileFromReq = (req, path) => {
  const ws = fs__default['default'].createWriteStream(path);
  req.pipe(ws);
};

const getFileShaSum = async filePath => {
  const integrity = await ssri__default['default'].fromStream(fs__default['default'].createReadStream(filePath), {
    algorithms: ['sha1']
  });
  return integrity.hexDigest();
};

const extractTgz = (path, to) => {
  return new Promise((resolve, reject) => {
    const extractor = fs__default['default'].createReadStream(path).pipe(gunzip__default['default']()).pipe(tar__default['default'].extract(to));
    extractor.on('error', err => {
      reject(err);
    });
    extractor.on('finish', () => {
      resolve();
    });
  });
};

const npm = new NpmApi__default['default']();

const extractServerPack = async (app, packPath) => {
  app.logger.info('Starting to extract the package...');
  await extractTgz(packPath, app.workDir); // extracted things are under a dir named package

  const {
    code: mvCode
  } = shelljs__default['default'].mv('./package/*', './');

  if (mvCode !== 0) {
    app.logger.error('Move server files failed.');
    process.exit(-10500);
  }

  const {
    code: rmCode
  } = shelljs__default['default'].rm('-rf', './package');

  if (rmCode !== 0) {
    app.logger.error('Remove temp folder failed.');
    process.exit(-10500);
  } // run npm install


  app.logger.info('Package extracted, starting to install dependencies...');

  try {
    child_process__default['default'].execSync('npm install', {
      stdio: 'inherit'
    });
  } catch {
    app.logger.error('Fail to install the dependecies of tigo server.');
  }

  app.logger.info('All things done, your tigo server is ready.');
};

const downloadServerPack = async app => {
  const repo = npm.repo('tigo');
  let pkg;

  try {
    pkg = await repo.package();
  } catch (err) {
    app.logger.error('Fetching server package failed.', err.mesage || err);
    process.exit(-10500);
  }

  const {
    tarball,
    shasum
  } = pkg.dist;
  app.logger.info('Server package founded on npm.');
  const tempSavePath = path__default['default'].resolve(app.tempDir, './server.tgz'); // check exists pack

  if (fs__default['default'].existsSync(tempSavePath)) {
    const localTempHash = await getFileShaSum(tempSavePath);

    if (shasum === localTempHash) {
      app.logger.info('Detected usable cached package, skip downloading.');
      extractServerPack(app, tempSavePath);
      return;
    }
  } // download package


  app.logger.info('Starting to download the package.');
  const bar = new progress__default['default'].SingleBar({
    format: chalk__default['default'].hex('#f16d41')('Downloading server package... [{bar}] {percentage}%'),
    hideCursor: true
  });
  const req = request__default['default'].get(tarball);
  bar.start(100, 0);
  req.on('progress', e => {
    bar.update(e.percent || 0);
  });

  try {
    writeFileFromReq(req, tempSavePath);
  } catch (err) {
    app.logger.error('Saving package failed.', err.message || err);
    process.exit(-10500);
  }

  bar.update(bar.getTotal());
  bar.stop(); // check sum

  const downloadedShaSum = getFileShaSum(tempSavePath);

  if (!downloadedShaSum !== shasum) {
    app.logger.error('Package hash mismatch.');
    process.exit(-10500);
  }

  extractServerPack(app, tempSavePath);
};

const mount = (app, program) => {
  program.command('init <template>').description('initialize project by using tigo templates (server, lambda)').action(async type => {
    // check work dir
    const dir = fs__default['default'].readdirSync(app.workDir);

    if (dir?.length > 0) {
      const answers = await inquirer__default['default'].prompt([{
        type: 'confirm',
        name: 'notEmpty',
        message: 'Current folder is not empty, continue initializing?',
        default: false
      }]);

      if (!answers.notEmpty) {
        return;
      }
    }

    if (type === 'server') {
      await downloadServerPack(app);
    } else {
      app.logger.error('You should specific a type to initialize.');
      program.help();
    }
  });
};

var modules = [mount];

const getEnvironment = () => {
  let nodeInstalled = false;
  let npmInstalled = false;
  const nodeVersionRes = shelljs__default['default'].exec('node -v', {
    silent: true
  });

  if (nodeVersionRes.code === 0) {
    nodeInstalled = true;
  }

  const npmVersionRes = shelljs__default['default'].exec('npm -v', {
    silent: true
  });

  if (npmVersionRes.code === 0) {
    npmInstalled = true;
  }

  return {
    nodeInstalled,
    npmInstalled,
    nodeVersion: nodeVersionRes.stdout.substr(1),
    npmVersion: npmVersionRes.stdout
  };
};

const checkEnvironment = ({
  minNodeVersion
}) => {
  const env = getEnvironment();

  if (!env.nodeInstalled) {
    throw new Error('Node.js is not installed, please install it first.');
  }

  if (!env.npmInstalled) {
    throw new Error('npm is not installed, pleast install it first.');
  }

  const nodeVer = parseInt(env.nodeVersion.split('.')[0], 10);

  if (nodeVer < minNodeVersion) {
    throw new Error(`Node.js is outdated, at least v${minNodeVersion} is required, please do upgrade first.`);
  }
};

log4js__default['default'].configure({
  appenders: {
    stdout: {
      type: 'stdout'
    }
  },
  categories: {
    default: {
      appenders: ['stdout'],
      level: 'info'
    }
  }
});
var logger = log4js__default['default'].getLogger();

const storePath = '~/.tigo/store.json';
const storeDir = path__default['default'].dirname(storePath);

if (!fs__default['default'].existsSync(storeDir)) {
  fs__default['default'].mkdirSync(storeDir, {
    recursive: true
  });
}

const getStore = () => {
  if (!fs__default['default'].existsSync(storePath)) {
    return {};
  }

  try {
    const store = JSON.parse(fs__default['default'].readFileSync(storePath, {
      encoding: 'utf-8'
    }));
    return store;
  } catch {
    return {};
  }
};
const setStore = (store, key, value) => {
  store[key] = value;
  fs__default['default'].writeFileSync(storePath, JSON.stringify(store), {
    encoding: 'utf-8'
  });
};

const tempDir = path__default['default'].resolve(__dirname, '../temp'); // create temp dir

if (!fs__default['default'].existsSync(tempDir)) {
  fs__default['default'].mkdirSync(tempDir, {
    recursive: true
  });
}

const app = {
  logger,
  tempDir,
  workDir: process.cwd(),
  store: getStore()
};

const program = new commander__default['default'].Command();
const version = '0.1.0';
program.name('tigo');
program.version(version);
console.log(chalk__default['default'].hex('#f16d41')(`tigo-cli ${version}\nDeveloped by BackRunner`)); // env check

if (!app.store.envCheckPassed) {
  app.logger.info('Checking environment...');

  try {
    checkEnvironment({
      minNodeVersion: 14
    });
  } catch (err) {
    app.logger.error(err.message);
    process.exit(-10400);
  }

  setStore(app.store, 'envCheckPassed', true);
} // load modules


modules.forEach(mount => {
  mount(app, program);
});
program.parse();
