const _ = require('../vendor/lodash.custom.js');

const { QueryPart } = require('./query-part-base');

const {
  contains_undefined,
  get_undefined_indices,
  isPlainObject,
} = require('./util');

export class EscapeLiteral {

  // pg version
  protected static escape_array(arr: any[]): string {
    let result = '{';
    for (let i = 0; i < arr.length; i++) {
      if (i > 0) result += ',';
      const val = arr[i];
      if (val === null || typeof val === 'undefined') {
	result += 'NULL';
      } else if (Array.isArray(val)) {
	result += this.escape_array(val);
      } else if (typeof val === 'number') {
	result += val;
      } else {
	result += JSON.stringify(typeof val === 'string' ? val : this.escape_value(val));
      }
    }
    return result + '}';
  }

  protected static escape_buffer(buffer: Buffer): string {
    return 'X' + this.escape_string(buffer.toString('hex'));
  }

  protected static _zero_pad(number: any, length: number): string {
    number = number.toString();
    while (number.length < length) {
      number = '0' + number;
    }
    return number;
  }

  protected static escape_date(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();
    const second = date.getSeconds();
    const millisecond = date.getMilliseconds();

    // YYYY-MM-DD HH:mm:ss.mmm
    return (
      this._zero_pad(year, 4) +
      '-' +
      this._zero_pad(month, 2) +
      '-' +
      this._zero_pad(day, 2) +
      ' ' +
      this._zero_pad(hour, 2) +
      ':' +
      this._zero_pad(minute, 2) +
      ':' +
      this._zero_pad(second, 2) +
      '.' +
      this._zero_pad(millisecond, 3)
    );
  }

  protected static escape_object(val: object): string {
    // can handle toPostgres if available
    // https://github.com/tgriesser/knex/blob/9aa7085b052938dc5252d10b2b418a475637eda5/lib/dialects/postgres/index.js#L75
    // could call val.toString()/SQL
    return JSON.stringify(val);
  }

  protected static escape_string(value: string): string {
    let has_backslash = false;
    let escaped = "'";
    for (let i = 0; i < value.length; i++) {
      const c = value[i];

      if (c === "'") {
        escaped += c + c;
      } else if (c === '\\') {
        escaped += c + c;
        has_backslash = true;
      } else {
        escaped += c;
      }
    }

    escaped += "'";

    if (has_backslash === true) {
      escaped = 'E' + escaped;
    }
    return escaped;
  };

  // https://github.com/knex/knex/blob/9aa7085b052938dc5252d10b2b418a475637eda5/lib/dialects/postgres/index.js#L51
  // https://github.com/knex/knex/blob/9aa7085b052938dc5252d10b2b418a475637eda5/lib/query/string.js#L22
  public static escape_value(value_or_fn: any): string {
    let value = typeof value_or_fn === 'function' ? value_or_fn() : value_or_fn;

    if (value === undefined || value === null) {
      return 'NULL';
    }

    switch (typeof value) {
      case 'boolean':
        return value ? 'true' : 'false';
      case 'number':
        return value + '';
      case 'object':
        if (value instanceof Date) {
          value = this.escape_date(value);
        } else if (Array.isArray(value)) {
          return `'${this.escape_array(value)}'`;
        } else if (Buffer.isBuffer(value)) {
          return this.escape_buffer(value);
        } else {
          return this.escape_object(value);
        }
    }

    return this.escape_string(value);
  }

}

type WrappedValue = (...params: unknown[]) => string | number;

export class WrapIdentifier {
  protected static _wrap_identifier(value: string):string {
    return value !== '*' ? `"${value.replace(/"/g, '""')}"` : '*';
  }

  protected static alias(first: string | number, second: string | number): string {
    return `${first} as ${second}`;
  }

  protected static wrap_string(value: string): string {
    const asIndex = value.toLowerCase().indexOf(' as ');
    if (asIndex !== -1) {
      const first = value.slice(0, asIndex);
      const second = value.slice(asIndex + 4);
      return this.alias(this.wrap(first), this.wrap_identifier(second));
    }
    const wrapped = [];
    let i = -1;
    const segments = value.split('.');
    while (++i < segments.length) {
      value = segments[i];
      if (i === 0 && segments.length > 1) {
        wrapped.push(this.wrap((value || '').trim()));
      } else {
        wrapped.push(this.wrap_identifier(value));
      }
    }
    return wrapped.join('.');
  }

  // Puts the appropriate wrapper around a value depending on the database
  // engine, unless it's a knex.raw value, in which case it's left alone.
  // https://github.com/knex/knex/blob/9aa7085b052938dc5252d10b2b418a475637eda5/lib/formatter.js#L174
  public static wrap(fn_or_value: string | number | WrappedValue): string | number {
    const value: any = typeof fn_or_value === 'function' ? fn_or_value() : fn_or_value;

    switch (typeof value) {
      case 'function':
        throw Error('already unwrapped value once');
      case 'object':
      case 'bigint':
      case 'symbol':
      case 'undefined':
      case 'boolean':
        throw Error(`${typeof value} identifiers are not yet supported`);
      case 'number':
        return value;
      default:
        return this.wrap_string(value + '');
    }
  }

  protected static wrap_identifier(value: string): string {
    return this._wrap_identifier((value || '').trim());
  }
}

/**
 * @param statement A SQL string with literal (?, :name) and identifier (??, :name:) placeholders
 * @param args      Single value, array of positional values, or object of named values
 */
export const escape = (statement: string, value: any): string => {
  if (isPlainObject(value)) {
    return escape_key_bindings(statement, value);
  } else {
    let values_array: any[] = [];

    if (Array.isArray(value)) {
      values_array = value;
    } else if (value) {
      values_array = [value];
    }

    return escape_placeholder_bindings(statement, values_array);
  }
}

// https://github.com/knex/knex/blob/4ade98980e489e18f18e8fdabf86cc275501c04c/lib/raw.js#L149
export const escape_key_bindings = (statement: string, values: { [index: string]: any }): string => {
  const regex = /\\?(::(\w+)::|:(\w+):|:(\w+))/g;

  const escaped_string = statement.replace(regex, (match: string, p1: string, p2: string, p3: string, p4: string) => {
    // the string is escaped
    if (match !== p1) {
      return p1;
    }

    const part = p2 || p3 || p4;
    const key = match.trim();
    const is_raw = key[key.length - 1] === ':' && key[key.length - 2] === ':';
    const is_identifier = !is_raw && key[key.length - 1] === ':';
    let value = values[part];

    if (value instanceof QueryPart) {
      value = value.param();
    }

    if (is_raw) {
      return `${value}`;
    }

    if (is_identifier) {
      return `${WrapIdentifier.wrap(value)}`;
    }

    return EscapeLiteral.escape_value(value);
  });

  return escaped_string;
}

// https://github.com/knex/knex/blob/4ade98980e489e18f18e8fdabf86cc275501c04c/lib/raw.js#L120
export const escape_placeholder_bindings = (statement: string, values: any[]): string => {
  const expected_bindings = values.length;
  let index = 0;

  if (contains_undefined(values)) {
    const undefined_binding_indices = get_undefined_indices(values);
    throw new Error(
      `Undefined binding(s) detected for keys [${undefined_binding_indices}] when compiling RAW query: ${statement}`
    );
  }

  // https://github.com/knex/knex/blob/4ade98980e489e18f18e8fdabf86cc275501c04c/lib/raw.js#L120
  const escaped_string = statement.replace(/\\\?|\?{1,3}/g, (match) => {
    // escaped questionmarks don't count
    if (match === '\\?') {
      return '?';
    }

    let value = values[index];
    index += 1;

    if (index > expected_bindings) {
      return match;
    }

    if (value instanceof QueryPart) {
      value = value.param();
    }

    if (match.length === 3) {
      // catch undefined?
      return `${value}`;
    }

    if (match.length === 2) {
      return `${WrapIdentifier.wrap(value)}`;
    }

    return EscapeLiteral.escape_value(value);
  });


  if (expected_bindings !== index) {
    throw new Error(`Expected ${expected_bindings} bindings, saw ${index}`);
  }

  return escaped_string;
};


