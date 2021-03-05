import fs from 'fs';
import tar from 'tar-fs';
import gunzip from 'gunzip-maybe';

export const extractTgz = (path: string, to: string): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const extractor = fs.createReadStream(path).pipe(gunzip()).pipe(tar.extract(to));
    extractor.on('error', (err) => {
      reject(err);
    });
    extractor.on('finish', () => {
      resolve();
    });
  });
};
