import superagent from 'superagent';
import { GitHubReleaseInfo } from '../interface/github';

const getRepoLatestRelease = async (repo: string): Promise<GitHubReleaseInfo> => {
  const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;
  const res = await superagent.get(apiUrl).set('User-Agent', 'tigo-cli');
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

export { getRepoLatestRelease };
