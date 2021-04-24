interface Host {
  https: boolean,
  host: string,
  port?: number,
}

export const parseHost = (host: string): Host => {
  const ret: Host = {
    https: host.startsWith('https'),
    host,
  };
  ret.host = host.replace(/^https?:\/\//, '');
  if (ret.host.endsWith('/')) {
    ret.host = ret.host.substr(0, ret.host.length - 1);
  }
  if (ret.host.includes(':')) {
    const parts = ret.host.split(':');
    ret.host = parts[0];
    ret.port = parseInt(parts[1], 0);
  }
  return ret;
};
