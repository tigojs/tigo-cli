/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { userDir } from '../constants/dir';
import path from 'path';
import fs from 'fs';

const CONFIG_PATH = path.resolve(userDir, './.tigo/userconfig.json');
const CONFIG_DIR = path.dirname(CONFIG_PATH);

if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

export const getConfig = (): any => {
  if (!fs.existsSync(CONFIG_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, { encoding: 'utf-8' }));
};

export const saveConfig = (config: any): void => {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, '  '), { encoding: 'utf-8' });
};
