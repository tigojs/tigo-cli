import commander from "commander";
import NpmApi from 'npm-api';
import { Application } from "../interface/application";
import { getRuntimeConfig } from "../utils/env";

const mount = async (app: Application, program: commander.Command): Promise<void> => {
  program
    .command('add <name>')
    .description('Add official module to tigo server')
    .action(async (name) => {
      const rc = await getRuntimeConfig(app.workDir);
      if (!rc) {
        app.logger.error('Cannot find configuration file for tigo.');
        process.exit(-10400);
      }
      if (rc.plugins) {
        Object.keys(rc.plugins).forEach((key) => {
          const node = rc.plugins ? rc.plugins[key] : null;
          if (!node) {
            return;
          }
          if (node.package.replace('@tigojs/', '') === name) {
            app.logger.info('This module has already existed.');
          }
        });
      }
      // fetch package info on npm
      
    });
};

export default mount;
