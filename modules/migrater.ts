import commander from 'commander';
import path from 'path';
import fs from 'fs';
import { Application } from '../interface/application';
import { checkServerDir, getRuntimeConfig, getRuntimeConfigStatus } from '../utils/env';
import { buildExternalScriptThis, ExternalScriptThis } from '../utils/external';

const mount = async (app: Application, program: commander.Command): Promise<void> => {
  program
    .command('migrate <moduleName> <version>')
    .description('Migrate to newer version module')
    .action(
      async (moduleName: string, version: string): Promise<void> => {
        if (!checkServerDir(app.workDir)) {
          app.logger.error('tigo server cannot be detected in the current folder.');
          return process.exit(-10404);
        }
        // check module
        const modulePath = path.resolve(app.workDir, `./node_modules/${moduleName}`);
        const prefixedModulePath = path.resolve(app.workDir, `./node_modules/@tigojs/${moduleName}`);
        let isPrefixed = false;
        if (!fs.existsSync(modulePath)) {
          if (!fs.existsSync(prefixedModulePath)) {
            app.logger.error('Cannot locate the module.');
            return process.exit(-10404);
          } else {
            // isPrefixed
            isPrefixed = true;
          }
        }
        // check script
        let formattedVersion = version.startsWith('v') ?  version : `v${version}`;
        if (formattedVersion.includes('x')) {
          formattedVersion = formattedVersion.replace(/x/g, '0');
        }
        const scriptPath = path.resolve(isPrefixed ? prefixedModulePath : modulePath, `./scripts/migrate/${formattedVersion}.js`);
        console.log(scriptPath);
        if (!fs.existsSync(scriptPath)) {
          app.logger.error('Cannot locate the migration script.');
          return process.exit(-10404);
        }
        // load migrate script
        const migrate = (await import(scriptPath)).default;
        if (migrate) {
          const rcStatus = getRuntimeConfigStatus(app.workDir);
          const rc = await getRuntimeConfig(rcStatus);
          let thisArg: ExternalScriptThis;
          if (rc) {
            thisArg = buildExternalScriptThis(app, rcStatus, rc);
          } else {
            thisArg = buildExternalScriptThis(app);
          }
          try {
            await migrate.call(thisArg);
          } catch (err) {
            app.logger.error('Migration failed.', err);
            return process.exit(-10523);
          }
        } else {
          app.logger.error('Cannot load migration script.');
          return process.exit(-10522);
        }
        app.logger.info('Migration has been done.');
      }
    );
};

export default mount;
