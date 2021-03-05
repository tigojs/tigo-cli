import path from 'path';
import fs from 'fs';
import { Application } from './interface/application';
import logger from './utils/logger';
import { getStore } from './utils/store';

const tempDir: string = path.resolve(__dirname, '../temp');

// create temp dir
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

export const app: Application = {
  logger,
  tempDir,
  workDir: process.cwd(),
  store: getStore(),
};
