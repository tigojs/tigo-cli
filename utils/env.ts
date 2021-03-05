import shelljs from 'shelljs';

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
