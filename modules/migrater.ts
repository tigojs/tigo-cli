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
        if (!fs.existsSync(modulePath)) {
          app.logger.error('Cannot locate the module.');
          return process.exit(-10404);
        }
        // check script
        const formattedVersion = version.startsWith('v') ? `v${version}` : '';
        const scriptPath = path.resolve(modulePath, `./scripts/${formattedVersion}.js`);
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
          await migrate.call(thisArg);
        } else {
          app.logger.error('Cannot load migration script.');
          return process.exit(-10522);
        }
        app.logger.info('Migration has been done.');
      }
    );
};

export default mount;
