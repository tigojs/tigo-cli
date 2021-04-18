import commander from 'commander';
import path from 'path';
import fs from 'fs';
import child_process from 'child_process';
import { Application } from '../interface/application';
import { checkServerDir, getRuntimeConfig, getRuntimeConfigStatus, writeRuntimeConfig } from '../utils/env';
import { RuntimeConfig } from '../interface/rc';

const mount = async (app: Application, program: commander.Command): Promise<void> => {
  program
    .command('remove <moduleName>')
    .description('Remove a module from tigo server')
    .action(async (moduleName: string) => {
      if (!checkServerDir(app.workDir)) {
        app.logger.error('tigo server cannot be detected in the current folder.');
        return process.exit(-10404);
      }
      const packageInfoPath = path.resolve(app.workDir, './package.json');
      if (!fs.existsSync(packageInfoPath)) {
        app.logger.error('Cannot find the package.json in the current folder.');
        return process.exit(-10407);
      }
      const packageInfo = JSON.parse(fs.readFileSync(packageInfoPath, { encoding: 'utf-8' }));
      const prefixedName = `@tigojs/${moduleName}`;
      const dependencies = Object.keys(packageInfo.dependencies || {});
      const devDependencies = Object.keys(packageInfo.devDependencies || {});
      const isPrefixed = dependencies.includes(prefixedName) || devDependencies.includes(prefixedName);
      if (!dependencies.includes(prefixedName) && !dependencies.includes(moduleName) && !devDependencies.includes(prefixedName) && !devDependencies.includes(moduleName)) {
        app.logger.error('This module is not installed on the server.');
        return;
      }
      // remove the package
      try {
        child_process.execSync(`npm remove ${isPrefixed ? prefixedName : moduleName}`);
      } catch {
        app.logger.error('Failed to remove the package.');
        return process.exit(-10520);
      }
      // remove configuration
      app.logger.debug('Processing the runtime config...');
      const rcStatus = getRuntimeConfigStatus(app.workDir);
      const rc = <RuntimeConfig>await getRuntimeConfig(rcStatus);
      if (rc.plugins) {
        const pluginNames = Object.keys(rc.plugins);
        for (const name of pluginNames) {
          if (rc.plugins[name].package === (isPrefixed ? prefixedName : moduleName)) {
            delete rc.plugins[name];
            break;
          }
        }
        writeRuntimeConfig(rcStatus, rc);
      }
      app.logger.info('Runtime config has been updated.');
      app.logger.info('Module has been removed successfully.');
    });
};

export default mount;
