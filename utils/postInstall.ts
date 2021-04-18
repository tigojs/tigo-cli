import shelljs from 'shelljs';
import { Logger } from 'log4js';
import { RuntimeConfig, RuntimeConfigStatus } from '../interface/rc';
import { Application } from '../interface/application';
import { writeRuntimeConfig } from '../utils/env';
import inquirer from 'inquirer';
import NpmApi from 'npm-api';

const npm = new NpmApi();

interface postInstallThis {
  inquirer: typeof inquirer;
  npm: typeof npm;
  workDir: string;
  shell: typeof shelljs;
  logger: Logger;
  rc: {
    status: RuntimeConfigStatus;
    content: RuntimeConfig;
    write: (status: RuntimeConfigStatus, rc: RuntimeConfig) => void;
  };
  getPluginConfig: (name: string) => unknown;
  updatePluginConfig: (name: string, operation: (config: unknown) => void) => void;
  saveRuntimeConfig: () => void;
}

export const buildPostInstallThisArg = (app: Application, rcStatus: RuntimeConfigStatus, rc: RuntimeConfig): postInstallThis => {
  const getPluginConfig = (name): unknown => {
    if (!rc.plugins) {
      return null;
    }
    const installedPlugins = Object.keys(rc.plugins);
    for (const pluginName of installedPlugins) {
      if (rc.plugins[pluginName].package === name) {
        return rc.plugins[pluginName].config || {};
      }
    }
    return null;
  };
  const saveRuntimeConfig = (): void => {
    writeRuntimeConfig(rcStatus, rc);
  };
  return {
    inquirer,
    workDir: app.workDir,
    npm,
    shell: shelljs,
    logger: app.logger,
    rc: {
      status: rcStatus,
      content: rc,
      write: writeRuntimeConfig,
    },
    getPluginConfig,
    updatePluginConfig: (name, operation): void => {
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
    },
    saveRuntimeConfig,
  };
};
