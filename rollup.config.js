import { babel } from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';

const extensions = ['.js', '.ts'];

export default {
  input: 'main.ts',
  output: {
    file: './bin/cli.js',
    format: 'cjs',
    banner: '#!/usr/bin/env node',
  },
  external: ['commander', 'chalk', 'log4js', 'npm-api', 'superagent', 'cli-progress', 'tar-fs', 'gunzip-maybe', 'ssri', 'shelljs', 'inquirer'],
  plugins: [
    nodeResolve({
      extensions,
      modulesOnly: true,
    }),
    babel({
      exclude: ['node_modules/**', './history/**'],
      babelHelpers: 'bundled',
      extensions,
    }),
  ],
};
