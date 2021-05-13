import shelljs from 'shelljs';
import { Logger } from 'log4js';
import { RuntimeConfig, RuntimeConfigStatus } from '../interface/rc';
import { Application } from '../interface/application';
import { writeRuntimeConfig } from './env';
import mysql from 'mysql2/promise';
import sqlite from 'sqlite3';
import inquirer from 'inquirer';
import NpmApi from 'npm-api';

const npm = new NpmApi();

export interface ExternalScriptThis {
  inquirer: typeof inquirer;
  npm: typeof npm;
  workDir: string;
  shell: typeof shelljs;
  logger: Logger;
  mysql: typeof mysql;
  sqlite: typeof sqlite;
  rc?: {
    status: RuntimeConfigStatus;
    content: RuntimeConfig;
    write: (status: RuntimeConfigStatus, rc: RuntimeConfig) => void;
  };
  getPluginConfig?: (name: string) => unknown;
  updatePluginConfig?: (name: string, operation: (config: unknown) => void) => void;
  saveRuntimeConfig?: () => void;
}

export const buildExternalScriptThis = (app: Application, rcStatus?: RuntimeConfigStatus, rc?: RuntimeConfig): ExternalScriptThis => {
  const properties = {
    inquirer,
    workDir: app.workDir,
    npm,
    shell: shelljs,
    logger: app.logger,
    mysql,
    sqlite,
  };
  if (rcStatus && rc) {
    const getPluginConfig = (packageName): unknown => {
      if (!rc || !rc.plugins) {
        return null;
      }
      const installedPlugins = Object.keys(rc.plugins);
      for (const pluginName of installedPlugins) {
        if (rc.plugins[pluginName].package === packageName) {
          if (!rc.plugins[pluginName].config) {
            rc.plugins[pluginName].config = {};
          }
          return rc.plugins[pluginName].config;
        }
      }
      return null;
    };
    const updatePluginConfig = (name, operation): void => {
      const config = getPluginConfig(name);
      if (config) {
        if (typeof operation === 'function') {
          operation(config);
        }
        saveRuntimeConfig();
        app.logger.info('Runtime config has been updated.');
      } else {
        app.logger.error('Cannot get the content of runtime config, please set your manually.');
      }
    };
    const saveRuntimeConfig = (): void => {
      writeRuntimeConfig(rcStatus, rc);
    };
    const rcProperties = {
      rc: {
        status: rcStatus,
        content: rc,
        write: writeRuntimeConfig,
      },
      getPluginConfig,
      updatePluginConfig,
      saveRuntimeConfig,
    };
    Object.assign(properties, rcProperties);
  }
  return properties;
};
