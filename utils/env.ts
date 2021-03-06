import shelljs from 'shelljs';
import path from 'path';
import fs from 'fs';
import { RuntimeConfig, RuntimeConfigStatus } from '../interface/rc';

interface EnvCheckOptions {
  minNodeVersion: number;
}

interface NodeEnvironment {
  nodeInstalled: boolean;
  npmInstalled: boolean;
  nodeVersion: string;
  npmVersion: string;
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
  const jsonPath = path.resolve(runtimeDir, './.tigorc');
  const jsPath = `${jsonPath}.js`;
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

export const getRuntimeConfig = async (runtimeDir: string): Promise<RuntimeConfig | null> => {
  const status = getRuntimeConfigStatus(runtimeDir);
  if (status.json.exists) {
    const rc = import(status.json.path);
    return rc;
  } else if (status.js.exists) {
    const rc = import(status.js.path);
    return rc;
  }
  return null;
};
