import fs from 'fs';
import ssri from 'ssri';

export const getFileShaSum = async (filePath: string): Promise<string> => {
  const integrity = await ssri.fromStream(fs.createReadStream(filePath), { algorithms: ['sha1'] });
  return integrity.hexDigest();
}
