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

export const isObject = (value: any) => {
  var type = typeof value;
  return value != null && (type == 'object' || type == 'function');
}

const getRawTag = (value: any) => {
  const is_own = Object.hasOwnProperty.call(value, Symbol.toStringTag);
  const tag = value[Symbol.toStringTag];
  let unmasked: boolean = false;

  try {
    value[Symbol.toStringTag] = undefined;
    unmasked = true;
  } catch (e) {}

  var result = Object.prototype.toString.call(value);
  if (unmasked) {
    if (is_own) {
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
    return Symbol.toStringTag in Object(value) ? getRawTag(value) :  Object.prototype.toString.call(value);
  }
}

export const isPlainObject = (value: any) => {
  const is_object_like = typeof value === 'object' && value !== null;
  const tag = baseGetTag(value);

  if (!is_object_like || tag !== '[object Object]') {
    return false
  }


  let proto = Object.getPrototypeOf(Object(value));

  if (proto === null) {
    return true;
  }

  const Ctor = Object.hasOwnProperty.call(proto, 'constructor') && proto.constructor;
  return typeof Ctor == 'function' && Ctor instanceof Ctor && Function.prototype.toString.call(Ctor) == Function.prototype.toString.call(Object);
}

export function contains_undefined(mixed: any): boolean {
  let arg_contains_undefined = false;

  if (nodeUtil.isTypedArray(mixed)) return false;

  if (Array.isArray(mixed)) {
    for (let i = 0; i < mixed.length; i++) {
      if (arg_contains_undefined) break;
      arg_contains_undefined = contains_undefined(mixed[i]);
    }
  } else if (isPlainObject(mixed)) {
    Object.keys(mixed).forEach((key) => {
      if (!arg_contains_undefined) {
        arg_contains_undefined = contains_undefined(mixed[key]);
      }
    });
  } else {
    arg_contains_undefined = mixed === undefined;
  }

  return arg_contains_undefined;
}

export function get_undefined_indices(mixed: any): Array<string|number> {
  const indices = [];

  if (Array.isArray(mixed)) {
    mixed.forEach((item, index) => {
      if (contains_undefined(item)) {
        indices.push(index);
      }
    });
  } else if (isPlainObject(mixed)) {
    Object.keys(mixed).forEach((key) => {
      if (contains_undefined(mixed[key])) {
        indices.push(key);
      }
    });
  } else {
    indices.push(0);
  }

  return indices;
}

// export const is_equal = (any[] | object): boolean => {
//   // const is_equal = !!exp.content!.find((i) => exp.content[i] !== list_sources[exp.name][i]);
// };

