import path from 'path';
import fs from 'fs';
import { CliStore } from '../interface/store';
import { userDir } from '../constants/dir';

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
};

export const setStore = (store: CliStore, key: string | Array<string>, value: unknown): void => {
  if (Array.isArray(key)) {
    key.forEach((k) => {
      store[k] = value;
    });
  } else if (typeof key === 'string') {
    store[key] = value;
  } else {
    return;
  }
  fs.writeFileSync(storePath, JSON.stringify(store), { encoding: 'utf-8' });
};
