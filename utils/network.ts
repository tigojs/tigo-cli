import { SuperAgentRequest } from 'superagent';
import fs from 'fs';

export const writeFileFromReq = async (req: SuperAgentRequest, path: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(path);
    ws.on('finish', () => {
      resolve();
    });
    ws.on('error', (err) => {
      reject(err);
    });
    req.pipe(ws);
  })
};
