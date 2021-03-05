import { SuperAgentRequest } from 'superagent';
import fs from 'fs';

export const writeFileFromReq = (req: SuperAgentRequest, path: string): void => {
  const ws = fs.createWriteStream(path);
  req.pipe(ws);
};
