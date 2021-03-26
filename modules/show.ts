import chalk from 'chalk';
import commander from 'commander';
import { Application } from '../interface/application';
import { getDevConfig, getRuntimeConfig } from '../utils/env';

const showRc = async (app: Application) => {
  const rc = await getRuntimeConfig(app.workDir);
  if (!rc) {
    app.logger.error('Cannot get content in .tigorc, the file may not exist.');
    return;
  }
  console.log(chalk.green(`Here's your .tigorc content: \n`), JSON.stringify(rc, null, '  '));
};

const showDevConfig = async (app: Application) => {
  const devConfig = getDevConfig(app);
  if (!devConfig.content) {
    app.logger.error('Cannot get content in .tigodev, the file may not exist.');
    return;
  }
  console.log(chalk.green(`Here's your .tigodev content: \n`), JSON.stringify(devConfig.content, null, '  '));
};

const mount = async (app: Application, program: commander.Command): Promise<void> => {
  const cmd = program
    .command('show')
    .description('Show the content of some files (like .tigorc)');
  cmd
    .command('rc')
    .description('Show content in the .tigorc')
    .action(() => {
      showRc(app);
    });
  cmd
    .command('devrc')
    .description('Show content in the .tigodev')
    .action(() => {
      showDevConfig(app);
    });
};

export default mount;
