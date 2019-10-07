const _ = require('lodash');
const knex = require('knex')({ client: 'pg' });

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

  protected static _convert_timezone(tz: string): number | boolean {
    if (tz === 'Z') {
      return 0;
    }
    const m = tz.match(/([+\-\s])(\d\d):?(\d\d)?/);
    if (m) {
      return (
        (m[1] == '-' ? -1 : 1) *
        (parseInt(m[2], 10) + (m[3] ? parseInt(m[3], 10) : 0) / 60) *
        60
      );
    }
    return false;
  }
  protected static escape_date(date: Date): string {
    const timeZone = 'local';

    const dt = new Date(date);
    let year;
    let month;
    let day;
    let hour;
    let minute;
    let second;
    let millisecond;

    if (timeZone === 'local') {
      year = dt.getFullYear();
      month = dt.getMonth() + 1;
      day = dt.getDate();
      hour = dt.getHours();
      minute = dt.getMinutes();
      second = dt.getSeconds();
      millisecond = dt.getMilliseconds();
    } else {
      const tz = this._convert_timezone(timeZone);

      if (tz !== false && tz !== 0) {
	dt.setTime((dt.getTime() as number) + (tz as number) * 60000);
      }

      year = dt.getUTCFullYear();
      month = dt.getUTCMonth() + 1;
      day = dt.getUTCDate();
      hour = dt.getUTCHours();
      minute = dt.getUTCMinutes();
      second = dt.getUTCSeconds();
      millisecond = dt.getUTCMilliseconds();
    }

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
    let hasBackslash = false;
    let escaped = "'";
    for (let i = 0; i < value.length; i++) {
      const c = value[i];

      if (c === "'") {
	escaped += c + c;
      } else if (c === '\\') {
	escaped += c + c;
	hasBackslash = true;
      } else {
	escaped += c;
      }
    }

    escaped += "'";

    if (hasBackslash === true) {
      escaped = 'E' + escaped;
    }
    return escaped;
  };

  public static escape_value(val: any): string {
    if (val === undefined || val === null) {
      return 'NULL';
    }
    switch (typeof val) {
      case 'boolean':
	return val ? 'true' : 'false';
      case 'number':
	return val + '';
      case 'object':
	if (val instanceof Date) {
	  val = this.escape_date(val);
	} else if (Array.isArray(val)) {
	  return this.escape_array(val);
	} else if (Buffer.isBuffer(val)) {
	  return this.escape_buffer(val);
	} else {
	  return this.escape_object(val);
	}
    }
    return this.escape_string(val);
  }

}

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
  public static wrap(value: any): string | number {
    switch (typeof value) {
      // case 'function':
      //   return this.outputQuery(this.compileCallback(value), true);
      // case 'object':
      //   return this.parseObject(value);
      case 'number':
        return value;
	// null? undefined? boolean?
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
export const escape = (statement: string, values: any): string => {
  const QueryPart = require('./erector').QueryPart;

  let values_array: any[] = [];
  if (_.isArray(values)) {
    values_array = values;
  } else if (values) {
    values_array = [values];
  }

  const expected_bindings = values_array.length;
  let index = 0;

  const escaped_string = statement.replace(/\\\?|\?{1,3}/g, (match) => {
    // escaped questionmarks don't count
    if (match === '\\?') {
      return '?';
    }

    let value = values_array[index];
    index += 1;

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


