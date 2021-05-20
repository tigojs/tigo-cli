import commander from 'commander';
import compareVersions from 'compare-versions';
import path from 'path';
import fs from 'fs';
import inquirer from 'inquirer';
import { Application } from '../interface/application';
import { checkServerDir, getRuntimeConfig } from '../utils/env';
import { getPanelData, getPanelLastestRelease, savePanelData } from '../utils/panel';
import { downloadFileWithProgress } from '../utils/network';
import { extractTgz } from '../utils/pack';

const mount = (app: Application, program: commander.Command): void => {
  const cmd = program.command('panel').description('tigo panel helpers');
  cmd.command('upgrade')
    .description('Upgrade your tigo-panel')
    .action(async () => {
      // get tigo panel data
      const panelData = getPanelData();
      // check server dir
      let panelRootPath;
      if (checkServerDir(app.workDir)) {
        const rc = await getRuntimeConfig(app.workDir);
        if (rc && rc.plugins) {
          // get @tigojs/fepanel config
          const installedPlugins = Object.keys(rc.plugins);
          let panelConfig;
          for (const pluginName of installedPlugins) {
            if (rc.plugins[pluginName].package === '@tigojs/fepanel') {
              if (rc.plugins[pluginName].config) {
                panelConfig = rc.plugins[pluginName].config;
                break;
              }
            }
          }
          if (panelConfig) {
            panelRootPath = panelConfig.distPath;
            savePanelData({
              ...panelData,
              rootPath: panelRootPath,
            });
          }
        }
      }
      if (!panelRootPath && panelData.rootPath && fs.existsSync(panelData.rootPath)) {
        panelRootPath = panelData.rootPath;
      }
      // ask user for the path
      if (!panelRootPath) {
        app.logger.warn('Cannot locate the tigo panel, please set it manually.');
        const ans = await inquirer.prompt([
          {
            type: 'input',
            name: 'root',
            message: 'The root path of tigo panel: ',
            validate: (v) => {
              if (!fs.existsSync(v)) {
                return 'The path does not exists.';
              }
              return true;
            },
          },
        ]);
        panelRootPath = ans.root;
        savePanelData({
          ...panelData,
          rootPath: panelRootPath,
        });
      }
      // check version
      let latestRelease;
      try {
        latestRelease = await getPanelLastestRelease();
      } catch (err) {
        app.logger.error('Cannot fetch the latest release info.');
        return process.exit(-10524);
      }
      if (!latestRelease || !latestRelease.tagName || !latestRelease.downloadUrl) {
        app.logger.error('Cannot fetch the latest release info.');
        return process.exit(-10524);
      }
      const releaseVer = latestRelease.tagName.substr(1);
      if (panelData.version) {
        if (compareVersions.compare(releaseVer, panelData.version, '<=')) {
          app.logger.info('Your tigo panel is already the latest version.');
          return process.exit(0);
        }
      } else {
        // ask users if they want to upgrade
        const ans = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Cannot detect the version of the panel, do you want to continue upgrading?',
            default: false,
          }
        ]);
        if (!ans.confirm) {
          return process.exit(0);
        }
      }
      // download the package
      const tempSavePath = path.resolve(app.tempDir, `./panel_${releaseVer}.tgz`);
      try {
        await downloadFileWithProgress(latestRelease.downloadUrl, tempSavePath, 'Downloading panel release... [{bar}] {percentage}%');
      } catch (err) {
        app.logger.error('Failed to download the panel release.', err.message || err);
        return process.exit(-10525);
      }
      try {
        await extractTgz(tempSavePath, panelRootPath);
      } catch (err) {
        app.logger.error('Failed extract the panel package.', err.message || err);
        return process.exit(-10526);
      }
      savePanelData({
        version: releaseVer,
        rootPath: panelRootPath,
      });
      app.logger.info('The panel has been upgraded.');
    });
};

export default mount;
