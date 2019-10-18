import util from 'util';

export const isString = (value: unknown): boolean => {
  // types added in v10.0.0
  // util.types && util.types.isStringObject(value)
  return (typeof value === 'string') || (value instanceof String);
};

export const sort = (value: any[]): any[] => {
  value.sort();
  return value;
};

// https://github.com/lodash/lodash/blob/4.17.15/lodash.js#L436
var nodeUtil = (function() {
  try {
    // Use `util.types` for Node.js 10+.
    var types = util.types;

    if (types) {
      return types;
    }

    // Legacy `process.binding('util')` for Node.js < 10.
    return (process as any).binding('util');
  } catch (e) {}
}());

export const isTypedArray = nodeUtil.isTypedArray;
