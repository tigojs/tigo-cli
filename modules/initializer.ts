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

const npm = new NpmApi();

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
    writeFileFromReq(req, tempSavePath);
  } catch (err) {
    app.logger.error('Saving package failed.', err.message || err);
    process.exit(-10500);
  }
  bar.update(bar.getTotal());
  bar.stop();
  // check sum
  const downloadedShaSum = getFileShaSum(tempSavePath);
  if (!downloadedShaSum !== shasum) {
    app.logger.error('Package hash mismatch.');
    process.exit(-10500);
  }
  extractServerPack(app, tempSavePath);
};

const mount = (app: Application, program: commander.Command): void => {
  program
    .command('init <template>')
    .description('initialize project by using tigo templates (server, lambda)')
    .action(async (type: string) => {
      // check work dir
      const dir = fs.readdirSync(app.workDir);
      if (dir?.length > 0) {
        const answers = await inquirer.prompt([{ type: 'confirm', name: 'notEmpty', message: 'Current folder is not empty, continue initializing?', default: false }]);
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

export default mount;
