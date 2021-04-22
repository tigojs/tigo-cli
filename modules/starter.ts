import commander from 'commander';
import inquirer from 'inquirer';
import path from 'path';
import fs from 'fs';
import child_process from 'child_process';
import { Application } from '../interface/application';
import { getConfig, updateConfigItem } from '../utils/config';
import { checkPM2, checkServerDir, getRuntimeConfig, getRuntimeConfigStatus } from '../utils/env';
import { checkServerStatus } from '../utils/server';
import { setStore } from '../utils/store';
import { checkPidExists } from '../utils/process';
import { downloadFileWithProgress } from '../utils/network';

const ECOSYS_CONFIG_URL = 'https://raw.githubusercontent.com/tigojs/tigo/main/ecosystem.config.js';

const ifUseFallback = async (app: Application, serverDir: string) => {
  const answer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Fallback to start server directly?',
      default: true,
    },
  ]);
  if (answer.confirm) {
    await startServerDirectly(app, serverDir);
  }
};

const startServerWithPM2 = async (app: Application, serverDir: string) => {
  // check ecosystem.config.js
  const ecosysConfigPath = path.resolve(serverDir, './ecosystem.config.js');
  if (!fs.existsSync(ecosysConfigPath)) {
    app.logger.error('Cannot find the ecosystem config for pm2.');
    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Do you want to download pm2 ecosystem configuration automatically?',
        default: true,
      },
    ]);
    if (answer.confirm) {
      app.logger.debug('Trying to download ecosystem.config.js...');
      try {
        downloadFileWithProgress(ECOSYS_CONFIG_URL, ecosysConfigPath);
      } catch (err) {
        app.logger.error('Failed to download the ecosystem.config.js.', err.message || err);
        // ask user whether to use fallback
        return await ifUseFallback(app, serverDir);
      }
    } else {
      // ask user whether to use fallback
      return await ifUseFallback(app, serverDir);
    }
  }
  try {
    child_process.execSync('pm2 start', { stdio: 'inherit', cwd: serverDir });
  } catch {
    app.logger.error('Cannot start with pm2, not fallback to directly start.');
    // next time start with pm2 need recheck the install status
    updateConfigItem('pm2_installed', false);
    return await startServerDirectly(app, serverDir);
  }
  setStore(app.store, 'lastRunType', 'pm2');
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
      setStore(app.store, 'lastRunPid', serverSpawn.pid);
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
  setStore(app.store, 'lastRunType', 'directly');
  process.exit(0);
};

const stopServerWithPM2 = async (app: Application, serverDir: string) => {
  const ecosysConfigPath = path.resolve(serverDir, './ecosystem.config.js');
  if (!fs.existsSync(ecosysConfigPath)) {
    app.logger.error('Failed to locate the ecosystem config for pm2.');
    return process.exit(-105102);
  }
  const ecosysConfig = (await import(ecosysConfigPath)).default;
  const appName = ecosysConfig.apps[0].name;
  app.logger.debug('Trying to stop server with pm2.');
  try {
    child_process.execSync(`pm2 stop ${appName}`, { stdio: 'inherit', cwd: serverDir });
  } catch {
    app.logger.error('Cannot stop server with pm2 due to an error.');
    return process.exit(-1005103);
  }
}

const stopServerDirectly = (app: Application, pid: number) => {
  try {
    process.kill(pid);
  } catch {
    app.logger.error('Failed to kill the server, please try again or stop it manually.');
    return process.exit(-1005102);
  }
  app.logger.info('Server has been stopped.');
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

const stopServer = async (app: Application, type: string, serverDir: string) => {
  try {
    if (type === 'pm2') {
      await stopServerWithPM2(app, serverDir);
    } else if (type === 'directly') {
      // check if lastRunPid exists
      const { lastRunPid } = app.store;
      if (!lastRunPid) {
        app.logger.warn('Cannot find the last run record, The server may not be running at the moment.');
        return process.exit(0);
      }
      if (!checkPidExists(lastRunPid)) {
        app.logger.error('Cannot locate the server in the system, please stop it manually.');
        return process.exit(0);
      }
      stopServerDirectly(app, lastRunPid);
    }
  } catch (err) {
    if (err.message) {
      app.logger.error(err.message);
    } else {
      app.logger.error('Failed to stop server.', err);
    }
    process.exit(-105101);
  }
};

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
      const serverStarted = () => {
        const { lastRunPid } = app.store;
        if (lastRunPid && checkPidExists(lastRunPid)) {
          const checked = checkPidExists(lastRunPid);
          if (checked) {
            app.logger.info('The server is already started.');
            return true;
          } else {
            setStore(app.store, 'lastRunPid', null);
          }
        } else {
          setStore(app.store, 'lastRunPid', null);
          return false;
        }
      }
      if (opts.directly) {
        if (serverStarted()) {
          return;
        }
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
          if (serverStarted()) {
            return;
          }
          await startServer(app, 'directly', serverDir);
        }
      }
    });
  program
    .command('stop')
    .description('Stop the tigo server.')
    .action(async () => {
      const cliConfig = getConfig();
      const serverDir = cliConfig?.server_dir || app.workDir;
      // normal process
      if (app.store.lastRunType === 'pm2') {
        app.logger.debug('Trying to stop server with pm2...');
        await stopServer(app, 'pm2', serverDir);
      } else {
        await stopServer(app, 'directly', serverDir);
      }
    });
};

export default mount;
