import shelljs from 'shelljs';
import path from 'path';
import fs from 'fs';
import { LambdaDevConfig, RuntimeConfig, RuntimeConfigStatus } from '../interface/rc';
import { Application } from '../interface/application';
import prettier from 'prettier';

interface EnvCheckOptions {
  minNodeVersion: number;
}

interface NodeEnvironment {
  nodeInstalled: boolean;
  npmInstalled: boolean;
  nodeVersion: string;
  npmVersion: string;
}

interface GitStatus {
  installed: boolean;
  version: string;
}

const getEnvironment = (): NodeEnvironment => {
  let nodeInstalled = false;
  let npmInstalled = false;
  const nodeVersionRes = shelljs.exec('node -v', { silent: true });
  if (nodeVersionRes.code === 0) {
    nodeInstalled = true;
  }
  const npmVersionRes = shelljs.exec('npm -v', { silent: true });
  if (npmVersionRes.code === 0) {
    npmInstalled = true;
  }
  return {
    nodeInstalled,
    npmInstalled,
    nodeVersion: nodeVersionRes.stdout.substr(1),
    npmVersion: npmVersionRes.stdout,
  };
};

export const checkEnvironment = ({ minNodeVersion }: EnvCheckOptions): void => {
  const env = getEnvironment();
  if (!env.nodeInstalled) {
    throw new Error('Node.js is not installed, please install it first.');
  }
  if (!env.npmInstalled) {
    throw new Error('npm is not installed, pleast install it first.');
  }
  const nodeVer = parseInt(env.nodeVersion.split('.')[0], 10);
  if (nodeVer < minNodeVersion) {
    throw new Error(`Node.js is outdated, at least v${minNodeVersion} is required, please do upgrade first.`);
  }
};

export const getRuntimeConfigStatus = (runtimeDir: string): RuntimeConfigStatus => {
  const rcPath = path.resolve(runtimeDir, './.tigorc');
  const jsonPath = path.resolve(`${rcPath}.json`);
  const jsPath = `${rcPath}.js`;
  const jsonExists = fs.existsSync(jsonPath);
  const jsExists = fs.existsSync(jsPath);
  return {
    exists: jsonExists || jsExists,
    json: {
      path: jsonPath,
      exists: jsonExists,
    },
    js: {
      path: jsPath,
      exists: jsExists,
    },
  };
};

async function getRuntimeConfig (workDir: string): Promise<RuntimeConfig | null>;
async function getRuntimeConfig (status: RuntimeConfigStatus): Promise<RuntimeConfig | null>;
async function getRuntimeConfig (arg: RuntimeConfigStatus | string): Promise<RuntimeConfig | null> {
  const rcStatus: RuntimeConfigStatus = typeof arg === 'string' ? getRuntimeConfigStatus(arg) : arg;
  if (rcStatus.json.exists) {
    const rc = JSON.parse(fs.readFileSync(rcStatus.json.path, { encoding: 'utf-8' }));
    return rc;
  } else if (rcStatus.js.exists) {
    const rc = import(rcStatus.js.path);
    return rc;
  }
  return null;
}

export { getRuntimeConfig };

export const writeRuntimeConfig = (status: RuntimeConfigStatus, config: RuntimeConfig): void => {
  if (status.js.exists) {
    fs.writeFileSync(status.js.path, prettier.format(`module.exports = ${JSON.stringify(config)}`, {
      tabWidth: 2,
      useTabs: false,
      singleQuote: true,
      semi: true,
    }), { encoding: 'utf-8' });
  } else if (status.json.exists) {
    fs.writeFileSync(status.json.path, JSON.stringify(config, null, '  '), { encoding: 'utf-8' });
  } else {
    throw new Error('Runtime config does not exist.');
  }
};

export const getDevConfig = (app: Application, dir?: string): LambdaDevConfig => {
  const devConfigPath = path.resolve(dir || app.workDir, './.tigodev.json');
  let devConfig;
  if (fs.existsSync(devConfigPath)) {
    try {
      devConfig = JSON.parse(fs.readFileSync(devConfigPath, { encoding: 'utf-8' }));
    } catch (err) {
      app.logger.error('Cannot read dev environment configuration.');
      throw err;
    }
  }
  return {
    path: devConfigPath,
    content: devConfig,
  };
};

export const checkGit = (): GitStatus => {
  const gitStatus = shelljs.exec('git --version', { silent: true });
  let gitInstalled = false;
  const gitVersion = gitStatus.stdout;
  if (gitStatus.code === 0) {
    gitInstalled = true;
  }
  return {
    installed: gitInstalled,
    version: gitVersion,
  };
};
