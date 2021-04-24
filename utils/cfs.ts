import path from 'path';
import fsp from 'fs/promises';
import fs from 'fs';
import { CFSDeployConfig } from '../interface/cfs';

export const writeCFSDeployConfig = async (conf: CFSDeployConfig, targetDir: string): Promise<void> => {
  const configPath = path.resolve(targetDir, './.tigo-cfs.json');
  await fsp.writeFile(configPath, JSON.stringify(conf, null, '  '), { encoding: 'utf-8' });
};

export const getCFSDeployConfig = async (targetDir: string): Promise<CFSDeployConfig> => {
  const configPath = path.resolve(targetDir, './.tigo-cfs.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('Cannot locate the CFS deploy configuration.');
  }
  const config = JSON.parse(await fsp.readFile(configPath, { encoding: 'utf-8' }));
  return config;
};
