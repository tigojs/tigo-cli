export const formatInputValue = (str: string): boolean | number | string => {
  if (/^(\+|-)?\d+.?(\d+)?$/.test(str)) {
    return parseFloat(str);
  } else if (str === 'true') {
    return true;
  } else if (str === 'false') {
    return false;
  }
  return str || '';
}