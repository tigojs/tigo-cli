import superagent from 'superagent';
import { Application } from '../interface/application';
import { RuntimeConfig } from '../interface/rc';

const delayExec = (fn: (...args) => Promise<unknown>, args: Array<unknown>, delay = 1000) => {
  return new Promise<void>((resolve, reject) => {
    setTimeout(async () => {
      try {
        await fn.call(null, ...args);
      } catch (err) {
        reject(err);
      }
      resolve();
    }, delay);
  });
};

const sendPing = async (app, url, retry = 0, retryLimit = 10) => {
  try {
    app.logger.debug(`Try ${retry + 1}: sending ping to server.`);
    await superagent.get(url);
  } catch {
    if (retry < retryLimit - 1) {
      await delayExec(sendPing, [app, url, retry + 1, retryLimit]);
    } else {
      throw new Error(`Cannot get response from server in ${retryLimit} tries.`);
    }
  }
};

export const checkServerStatus = async (app: Application, rc: RuntimeConfig): Promise<void> => {
  const { port } = rc.server;
  const base = rc.router?.internal?.base || '/api';
  const url = `http://127.0.0.1:${port}${base}/common/checkAvailable`;
  app.logger.debug('Starting to detect the server status.');
  await delayExec(sendPing, [app, url]);
};
