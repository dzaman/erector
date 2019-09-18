const _ = require('lodash');
const escape = require('knex')({ client: 'pg' }).raw;

class Raw {
  constructor(string) {
    this.string = string;
  }
}

class ListLabels {
  constructor(name, content, array, object) {
    this.name = name;
    this.content = content;
    this.array = array;
    this.object = object;
  }
}

class ListValues {
  constructor(name, content, array, object) {
    this.name = name;
    this.content = content;
    this.array = array;
    this.object = object;
  }
}

class Statement {
  constructor(string, params) {
    this.string = string;
    this.params = params;
  }
}

const sql = (strings, ...exps) => {
  // const string = strings.join('?');
  let strings_and_placeholders = [];

  const lists = {};

  for (let i = 0; i < exps.length; i += 1) {
    if (typeof exps[i] === 'function') {
      exps[i] = exps[i]();
    } else if (exps[i] instanceof Statement) {
      exps[i] = escape(exps[i].string, exps[i].params).toString();
    } else if (exps[i] instanceof ListLabels) {
      const key = exps[i].
      lists[
      
    } else if (exps[i] instanceof ListValues) {
    }
  }

  for (let i = 0; i < strings.length - 1; i += 1) {
    const count = _.isArray(exps[i]) ? _.size(exps[i]) : 1;

    console.log('count', count);

    if (exps[i] instanceof Raw) {
      console.log('is raw');
      strings_and_placeholders.push(strings[i]);
      strings_and_placeholders.push(exps[i].string);
    } else {
      if (strings[i][strings[i].length - 1] === '"' &&
          strings[i + 1][0] === '"') {
        strings_and_placeholders.push(strings[i].substring(0, strings[i].length - 1));
        strings_and_placeholders.push(_.range(count).map(() => '??').join(', '));
        strings[i + 1] = strings[i + 1].substring(1);
      } else {
        strings_and_placeholders.push(strings[i]);
        strings_and_placeholders.push(_.range(count).map(() => '?').join(', '));
      }
    }

  }

  return new Statement(
    strings_and_placeholders.join(''),
    _.flatten(_.filter(exps, (exp) => !(exp instanceof Raw))),
  );
}

sql.if = (test, pass, fail) => test ? pass : fail;

sql.values = (...args) => {
  const has_name = _.isString(args[0]);
  const list = has_name ? args[1] : args[0];
  const name = has_name ? args[0] : null;
  return new ListValues(name, list);
};

sql.labels = (...args) => {
  const has_name = _.isString(args[0]);
  const list = has_name ? args[1] : args[0];
  const name = has_name ? args[0] : null;
  const is_array = _.isArray(list);
  const array = is_array : list : null;
  const object = is_array : null : list;
  return new ListLabels(name, list, array, object);
};

sql.set = (object, options = {}) => {
  if (_.isObject(object)) {
    throw Error('not an object');
  }

  const keys = _.sortBy(_.keys(object));
  const assignments = _.map(keys, (key) => `${key}=${object[key]}`);

  return assignments.join(', ') || options.default || '';
};

sql.setdefined = (object, options = {}) => {
  const definedObject = _.reduce(object, (acc, value, key) => {
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});

  return this.set(definedObject, options);
};

sql.raw = (string) => {
  return new Raw(string);
};

sql.i = sql.identifier = (value) => {
  return escape('??', [value]).toString();
};

sql.cmp = (test, ...args) => {

};

sql.and = (...exps) => {
  return exps.filter((exp) => exp).join(' AND ');
};

sql.or = (...exps) => {
  return exps.filter((exp) => exp).join(' OR ');
};

module.exports = {
  sql,
  ...sql,
};

console.log(module.exports);

// console.log(sql`That ${1} is a "${2}" and a ${() => 'foo'}`);
// console.log(sql`This needs a ${['foo', 'bar']}`);
// console.log(sql`This needs a "${['foo', 'bar']}"`);

const bar = 'a';
const foo = 'b';
const test = true;
console.log(sql`
  ${sql.raw('foobar')}
  ${sql.if(test, sql`${bar}`, sql`${foo}`)}
`);
