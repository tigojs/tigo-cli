import log4js from 'log4js';
import { CliStore } from './store';

export interface Application {
  logger: log4js.Logger;
  tempDir: string;
  workDir: string;
  store: CliStore;
}
