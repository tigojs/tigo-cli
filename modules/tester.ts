import commander from 'commander';
import path from 'path';
import fs from 'fs';
import { Application } from '../interface/application';
import { buildPostInstallThisArg } from '../utils/postInstall';
import { getRuntimeConfig, getRuntimeConfigStatus } from '../utils/env';

const mount = async (app: Application, program: commander.Command): Promise<void> => {
  const cmd = program.command('test').description('Test tools for developers');
  cmd
    .command('postInstall <file>')
    .option('--work-dir <dir>', 'Mock the work dir to a specific value for app.')
    .action(async (file, opts) => {
      const filePath = path.resolve(file);
      if (!fs.existsSync(filePath)) {
        app.logger.error('Cannot find the script file.');
        return process.exit(-104101);
      }
      let application = app;
      if (opts.workDir) {
        const dirPath = path.resolve(opts.workDir);
        if (!fs.existsSync(dirPath)) {
          app.logger.error('Cannot find the specific work directory.');
          return process.exit(-104102);
        }
        const handler = {
          get(target, prop) {
            if (prop === 'workDir') {
              return opts.workDir;
            }
          },
        };
        application = new Proxy(app, handler);
      }
      const rcStatus = await getRuntimeConfigStatus(opts.workDir || app.workDir);
      const rc = await getRuntimeConfig(rcStatus);
      if (!rc) {
        app.logger.error('Cannot get the runtime config in the work directory.');
        return process.exit(-104101);
      }
      const postInstall = (await import(filePath)).default;
      if (postInstall) {
        await postInstall.call(buildPostInstallThisArg(application, rcStatus, rc));
      } else {
        app.logger.error('Cannot import the script.');
        return process.exit(-104103);
      }
    });
};

export default mount;
