import shelljs from 'shelljs';
import path from 'path';
import fs from 'fs';
import { LambdaDevConfig, RuntimeConfig, RuntimeConfigStatus } from '../interface/rc';
import { Application } from '../interface/application';
import prettier from 'prettier';
import chalk from 'chalk';

interface EnvCheckOptions {
  minNodeVersion: number;
}

interface GitStatus {
  installed: boolean;
  version: string;
}

export const checkEnvironment = ({ minNodeVersion }: EnvCheckOptions): void => {
  const nodeVer = parseInt(process.versions.node.split('.')[0], 10);
  if (nodeVer < minNodeVersion) {
    console.error(chalk.red(`Node.js is outdated, at least v${minNodeVersion} is required, please do upgrade first.`));
    process.exit(-10001);
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

export const checkServerDir = (dir: string): boolean => {
  return getRuntimeConfigStatus(dir).exists;
}

async function getRuntimeConfig (workDir: string): Promise<RuntimeConfig | null>;
async function getRuntimeConfig (status: RuntimeConfigStatus): Promise<RuntimeConfig | null>;
async function getRuntimeConfig (arg: RuntimeConfigStatus | string): Promise<RuntimeConfig | null> {
  const rcStatus: RuntimeConfigStatus = typeof arg === 'string' ? getRuntimeConfigStatus(arg) : arg;
  if (rcStatus.json.exists) {
    const rc = JSON.parse(fs.readFileSync(rcStatus.json.path, { encoding: 'utf-8' }));
    return rc;
  } else if (rcStatus.js.exists) {
    const rc = (await import(rcStatus.js.path)).default;
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
      parser: 'babel',
    }), { encoding: 'utf-8' });
  } else {
    // js config file does not exist, write config in json format by default
    fs.writeFileSync(status.json.path, JSON.stringify(config, null, '  '), { encoding: 'utf-8' });
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
