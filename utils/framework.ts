import path from 'path';
import fs from 'fs';
import NpmApi from 'npm-api';
import { Application } from '../interface/application';
import { getFileShaSum } from './hash';
import { extractTgz } from './pack';
import { downloadFileWithProgress } from './network';

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
  app.logger.debug('Starting to extract the package...');
  await extractTgz(packPath, targetPath);
};

export const downloadFrameworkPack = async (app: Application, packageInfo?: unknown): Promise<DownloadMethodReturns> => {
  const repo = npm.repo('tigo');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pkg = <any>packageInfo;
  if (!pkg) {
    try {
      pkg = await repo.package();
    } catch (err) {
      app.logger.error('Fetching server package failed.', err.message || err);
      return process.exit(-10508);
    }
  }
  const { version: pkgVer } = pkg;
  const { tarball, shasum } = pkg.dist;
  app.logger.debug('Server package has been found on npm.');
  const tempSavePath = path.resolve(app.tempDir, `./server_${pkgVer}.tgz`);
  // check exists pack
  if (fs.existsSync(tempSavePath)) {
    const localTempHash = await getFileShaSum(tempSavePath);
    if (shasum === localTempHash) {
      app.logger.debug('Detected usable cached package, skip downloading.');
      return { packPath: tempSavePath };
    }
  }
  // download package
  app.logger.debug('Starting to download the package...');
  try {
    await downloadFileWithProgress(tarball, tempSavePath, 'Downloading server package... [{bar}] {percentage}%');
  } catch (err) {
    app.logger.error('Failed to download the server package.', err.message || err);
    return process.exit(-10509);
  }
  // check sum
  const downloadedShaSum = await getFileShaSum(tempSavePath);
  if (downloadedShaSum !== shasum) {
    app.logger.error('Package hash mismatch.');
    return process.exit(-10512);
  }
  return { packPath: tempSavePath };
};
