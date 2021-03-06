import path from 'path';
import fs from 'fs';
import { CliStore } from './../interface/store';

const userDir = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share");

const storePath = path.resolve(userDir, './.tigo/store.json');
  const storeDir = path.dirname(storePath);
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
  }

export const getStore = (): CliStore => {
  if (!fs.existsSync(storePath)) {
    return {};
  }
  try {
    const store = JSON.parse(fs.readFileSync(storePath, { encoding: 'utf-8' }));
    return store;
  } catch {
    return {};
  }
}

export const setStore = (store: CliStore, key: string, value: unknown): void => {
  store[key] = value;
  fs.writeFileSync(storePath, JSON.stringify(store), { encoding: 'utf-8' });
}
