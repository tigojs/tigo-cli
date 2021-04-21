import commander from 'commander';
import path from 'path';
import fs from 'fs';
import child_process from 'child_process';
import { Application } from '../interface/application';
import { getConfig, updateConfigItem } from '../utils/config';
import { checkPM2, checkServerDir, getRuntimeConfig, getRuntimeConfigStatus } from '../utils/env';
import { checkServerStatus } from '../utils/server';
import { setStore } from '../utils/store';

const startServerWithPM2 = async (app: Application, serverDir: string) => {
  // check ecosystem.config.js
  const ecosysConfigPath = path.resolve(serverDir, './ecosystem.config.js');
  if (!fs.existsSync(ecosysConfigPath)) {
    throw new Error('Cannot find the ecosystem config for pm2.');
    // TODO: Auto download ecosystem.config.js from github.
  }
  try {
    child_process.execSync('pm2 start', { stdio: 'inherit', cwd: serverDir });
  } catch {
    app.logger.error('Cannot start with pm2, not fallback to directly start.');
    // next time start with pm2 need recheck the install status
    updateConfigItem('pm2_installed', false);
    await startServerDirectly(app, serverDir);
  }
};

const startServerDirectly = async (app: Application, serverDir: string) => {
  const rcStatus = getRuntimeConfigStatus(serverDir);
  if (!rcStatus.exists) {
    throw new Error('Cannot get the runtime config.');
  }
  const rc = await getRuntimeConfig(rcStatus);
  if (!rc) {
    throw new Error('Runtime config content is empty.');
  }
  const serverMainPath = path.resolve(serverDir, './server.js');
  if (!fs.existsSync(serverMainPath)) {
    throw new Error('Cannot locate the main file of tigo server.');
  }
  const spawn = () => {
    return new Promise<void>(async (resolve, reject) => {
      const serverSpawn = child_process.spawn('node', [serverMainPath], {
        detached: true,
        stdio: ['ignore', 'ignore', 'ignore'],
        env: {
          NODE_DEV: 'prod',
          DB_END: 'prod',
        },
      });
      serverSpawn.on('error', (err) => {
        reject(err);
      });
      try {
        await checkServerStatus(app, rc)
      } catch (err) {
        return reject(err);
      }
      serverSpawn.unref();
      // record pid
      setStore(app.store, 'last_run_pid', serverSpawn.pid);
      resolve();
    });
  };
  app.logger.debug('Starting the server...');
  try {
    await spawn();
  } catch {
    app.logger.error('Cannot spawn the server, please start it manually.');
    return process.exit(-100521);
  }
  app.logger.info('Server started.');
  process.exit(0);
};

const startServer = async (app: Application, type: string, serverDir: string) => {
  try {
    if (type === 'pm2') {
      await startServerWithPM2(app, serverDir);
    } else if (type === 'directly') {
      await startServerDirectly(app, serverDir);
    }
  } catch (err) {
    if (err.message) {
      app.logger.error(err.message);
    } else {
      app.logger.error('Failed to start server.', err);
    }
    process.exit(-105100);
  }
}

const mount = async (app: Application, program: commander.Command): Promise<void> => {
  program
    .command('start')
    .option('--directly', 'Start server directly.')
    .description('Start the tigo server.')
    .action(async (opts) => {
      const cliConfig = getConfig();
      const serverDir = cliConfig?.server_dir || app.workDir;
      if (!checkServerDir(serverDir)) {
        app.logger.error('Cannot locate the tigo server.');
        process.exit(-10409);
      }
      // TODO: check existed process
      if (opts.directly) {
        return await startServer(app, 'directly', serverDir);
      }
      if (cliConfig?.pm2_installed) {
        app.logger.debug('Trying to start server with pm2...');
        await startServer(app, 'pm2', serverDir);
      } else {
        // detect pm2
        app.logger.debug('Detecting pm2...');
        if (checkPM2()) {
          await startServer(app, 'pm2', serverDir);
        } else {
          await startServer(app, 'directly', serverDir);
        }
      }
    });
  program
    .command('stop')
    .description('Stop the tigo server.');
};

export default mount;
