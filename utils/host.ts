interface Host {
  https: boolean,
  host: string,
}

export const parseHost = (host: string) => {
  const ret: Host = {
    https: host.startsWith('https'),
    host,
  };
  ret.host = host.replace(/^https?:\/\//, '');
  if (ret.host.endsWith('/')) {
    ret.host = ret.host.substr(0, ret.host.length - 1);
  }
  return ret;
};
