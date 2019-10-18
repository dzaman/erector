import util from 'util';

export const isString = (value: unknown): boolean => {
  // types added in v10.0.0
  // util.types && util.types.isStringObject(value)
  return (typeof value === 'string') || (value instanceof String);
}
