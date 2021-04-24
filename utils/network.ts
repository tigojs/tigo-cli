import chalk from 'chalk';
import request, { SuperAgentRequest } from 'superagent';
import fs from 'fs';
import progress from 'cli-progress';

export const downloadFileWithProgress = async (sourceURL: string, targetPath: string, barMessage?: string): Promise<void> => {
  const bar = new progress.SingleBar({
    format: chalk.cyan(barMessage || `Downloading file from ${sourceURL}... [{bar}] {percentage}%`),
    hideCursor: true,
  });
  const req = request.get(sourceURL);
  bar.start(100, 0);
  req.on('progress', (e) => {
    bar.update(e.percent || 0);
  });
  await writeFileFromReq(req, targetPath);
  bar.update(bar.getTotal());
  bar.stop();
};

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
  });
};
