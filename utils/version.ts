export const formatVersion = (ver: string): string => {
  let formatted = ver;
  while(!/^\d/.test(formatted)) {
    if (!formatted || formatted.length <= 1) {
      throw new Error('Invalid version string.');
    }
    formatted = formatted.substr(1);
  }
  return formatted;
}