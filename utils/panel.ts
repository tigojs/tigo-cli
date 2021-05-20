import path from 'path';
import fs from 'fs';
import superagent from 'superagent';
import { userDir } from '../constants/dir';

interface PanelData {
  rootPath?: string;
  version?: string;
}

interface PanelReleaseData {
  tagName?: string;
  downloadUrl?: string;
}

const RELEASE_API = 'https://api.github.com/repos/tigojs/tigo-panel/releases/latest';

const dataPath = path.resolve(userDir, './.tigo/panel.json');
const dataDir = path.dirname(dataPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const getPanelData = (): PanelData => {
  if (!fs.existsSync(dataPath)) {
    return {};
  }
  try {
    const data = JSON.parse(fs.readFileSync(dataPath, { encoding: 'utf-8' }));
    return data;
  } catch {
    return {};
  }
};

export const savePanelData = (data: PanelData): void => {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, '  '), { encoding: 'utf-8' });
};

export const getPanelLastestRelease = async (): Promise<PanelReleaseData> => {
  const res = await superagent.get(RELEASE_API).set('User-Agent', 'tigo-cli');
  const { tag_name, assets } = res.body;
  const data = {};
  if (tag_name && typeof tag_name === 'string') {
    Object.assign(data, {
      tagName: tag_name,
    });
  }
  if (assets.length) {
    const asset = assets[0];
    Object.assign(data, {
      downloadUrl: asset.browser_download_url,
    });
  }
  return data;
};
