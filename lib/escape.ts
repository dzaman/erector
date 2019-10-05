// postgres escapeString: https://github.com/tgriesser/knex/blob/9aa7085b052938dc5252d10b2b418a475637eda5/lib/dialects/postgres/index.js#L55
// generic escapeString: https://github.com/tgriesser/knex/blob/9aa7085b052938dc5252d10b2b418a475637eda5/lib/query/string.js#L82

export const arrayString(arr, esc) {
  let result = '{';
  for (let i = 0; i < arr.length; i++) {
    if (i > 0) result += ',';
    const val = arr[i];
    if (val === null || typeof val === 'undefined') {
      result += 'NULL';
    } else if (Array.isArray(val)) {
      result += arrayString(val, esc);
    } else if (typeof val === 'number') {
      result += val;
    } else {
      result += JSON.stringify(typeof val === 'string' ? val : esc(val));
    }
  }
  return result + '}';
}

export const escape_array() {
}

export const escape_buffer() {
}

export const escape_date() {
}

export const escape_object() {
}

export const escape_string = (value: string): string => {
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

/**
 * @param statement A SQL string with literal (?, :name) and identifier (??, :name:) placeholders
 * @param args      Single value, array of positional values, or object of named values
 */
// export const escape = (statement: string, arg: any): string => knex.raw(statement, arg).toString();
export const escape = (statement: string, values: any): string => {
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
      return knex.raw('??', value).toString();
    }

    return knex.raw('?', value).toString();
  });

  if (expected_bindings !== index) {
    throw new Error(`Expected ${expected_bindings} bindings, saw ${index}`);
  }

  return escaped_string;
};
