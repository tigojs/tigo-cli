import path from 'path';
import fsp from 'fs/promises';
import fs from 'fs';
import { CFSDeployConfig } from '../interface/cfs';

export const writeCFSDeployConfig = async (conf: CFSDeployConfig, targetPath: string): Promise<void> => {
  await fsp.writeFile(targetPath, JSON.stringify(conf, null, '  '), { encoding: 'utf-8' });
};

export const getCFSDeployConfig = async (directory: string): Promise<CFSDeployConfig> => {
  const configPath = path.resolve(directory, './tigo-cfs.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('Cannot locate the CFS deploy configuration.');
  }
  const config = JSON.parse(await fsp.readFile(configPath, { encoding: 'utf-8' }));
  return config;
};
