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

export const isObject = (value: any) => {
  var type = typeof value;
  return value != null && (type == 'object' || type == 'function');
}

const getRawTag = (value: any) => {
  var isOwn = Object.hasOwnProperty.call(value, Symbol.toStringTag),
      tag = value[Symbol.toStringTag];

  try {
    value[Symbol.toStringTag] = undefined;
    var unmasked = true;
  } catch (e) {}

  var result = Object.prototype.toString.call(value);
  if (unmasked) {
    if (isOwn) {
      value[Symbol.toStringTag] = tag;
    } else {
      delete value[Symbol.toStringTag];
    }
  }
  return result;
}

const baseGetTag = (value: any) => {
  if (value === undefined) {
    return '[object Undefined]';
  } else if (value === null) {
    return '[object Null]';
  } else {
    return (Symbol.toStringTag in Object(value)) ? getRawTag(value) : Object.prototype.toString(value);
  }
}

export const isPlainObject = (value: any) => {
  if (value !== null && typeof value === 'object' || baseGetTag(value) !== '[object Object]') {
    return false;
  }
  // function overArg(func, transform) {
  //   return function(arg) {
  //     return func(transform(arg));
  //   };
  // }
  // overArg(Object.getPrototypeOf, Object)
  // handle null/undefined case
  var proto = Object.getPrototypeOf(Object(value));
  if (proto === null) {
    return true;
  }
  var Ctor = hasOwnProperty.call(proto, 'constructor') && proto.constructor;
  return typeof Ctor == 'function' && Ctor instanceof Ctor &&
    Function.prototype.toString.call(Ctor) == objectCtorString;
}
