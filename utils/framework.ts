import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import request from 'superagent';
import NpmApi from 'npm-api';
import progress from 'cli-progress';
import { Application } from '../interface/application';
import { getFileShaSum } from './hash';
import { writeFileFromReq } from './network';
import { extractTgz } from './pack';

const npm = new NpmApi();

interface ExtractMethodParams {
  app: Application;
  packPath: string;
  targetPath: string;
}

interface DownloadMethodReturns {
  packPath: string;
}

export const extractFrameworkPack = async ({ app, packPath, targetPath }: ExtractMethodParams): Promise<void> => {
  app.logger.info('Starting to extract the package...');
  await extractTgz(packPath, targetPath);
};

export const downloadFrameworkPack = async (app: Application): Promise<DownloadMethodReturns> => {
  const repo = npm.repo('tigo');
  let pkg;
  try {
    pkg = await repo.package();
  } catch (err) {
    app.logger.error('Fetching server package failed.', err.message || err);
    throw err;
  }
  const { version: pkgVer } = pkg;
  const { tarball, shasum } = pkg.dist;
  app.logger.info('Server package founded on npm.');
  const tempSavePath = path.resolve(app.tempDir, `./server_${pkgVer}.tgz`);
  // check exists pack
  if (fs.existsSync(tempSavePath)) {
    const localTempHash = await getFileShaSum(tempSavePath);
    if (shasum === localTempHash) {
      app.logger.info('Detected usable cached package, skip downloading.');
      return { packPath: tempSavePath };
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
    await writeFileFromReq(req, tempSavePath);
  } catch (err) {
    app.logger.error('Saving package failed.', err.message || err);
    throw err;
  }
  bar.update(bar.getTotal());
  bar.stop();
  // check sum
  const downloadedShaSum = await getFileShaSum(tempSavePath);
  if (downloadedShaSum !== shasum) {
    throw new Error('Package hash mismatch.');
  }
  return { packPath: tempSavePath };
};