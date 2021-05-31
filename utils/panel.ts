import path from 'path';
import fs from 'fs';
import { userDir } from '../constants/dir';

interface PanelData {
  rootPath?: string;
  version?: string;
}

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
