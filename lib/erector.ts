const _ = require('lodash');
const knex = require('knex')({ client: 'pg' });


// TODO: configuration option -> generate strings or Statements
// TODO: configuration option -> left operand default type is identifier

/**
 * @param statement A SQL string with literal (?, :name) and identifier (??, :name:) placeholders
 * @param args      Single value, array of positional values, or object of named values
 */
export const escape = (statement: string, arg: any): string => knex.raw(statement, arg).toString();

interface QueryPartConstructor {
  new(value: any): QueryPart;
}

export abstract class QueryPart {

  static escape = escape;

  public abstract format(): string;

  // public abstract text(): string;
  // public abstract placeholders(): any[];

  public toString(): string {
    return this.format();
  }

}

export abstract class SimpleQueryPart extends QueryPart {

  protected value: any;

  constructor(value: any) {
    super();

    this.value = value;
  }

  public static make_template_factory(target_class: QueryPartConstructor) {
    return (strings: string[], ...exps) => {
      const values: string[] = [];
   
      for (let i = 0; i < strings.length; i++) {
        values.push(strings[i]);

        if (i < exps.length) {
          values.push(`${exps[i]}`);
        }
      }
      
      return new target_class(values.join(''));
    };
  }

}

export class Raw extends SimpleQueryPart {
  
  public format(): string {
    return this.value.toString();
  }

}

export class Literal extends SimpleQueryPart {

  public format(): string {
    return (<typeof Literal>this.constructor).escape('?', this.value).toString();
  }

}
 
export class Identifier extends SimpleQueryPart {

  public format(): string {
    return (<typeof Identifier>this.constructor).escape('??', this.value).toString();
  }

}

// class AbstractList {
//   constructor() {
//     throw Error('AbstractList cannot be instantiated');
//   }
// 
//   format(content, array, object) {
//     // TODO
//   }
// }

//class ListLabels {
//  constructor(name, content, array, object) {
//    this.name = name;
//    this.content = content;
//    this.array = array;
//    this.object = object;
//  }
//}
//
//class ListValues {
//  name: string;
//  content: Array | Object;
//  array: Array;
//  object: Object;
//
//  constructor(name, content, array, object) {
//    this.name = name;
//    this.content = content;
//    this.array = array;
//    this.object = object;
//  }
//}

export type StatementParam = string | number | boolean | QueryPart;
export type StatementParams = Array<StatementParam>;

class Statement extends QueryPart {

  protected text: string;
  protected params: StatementParams;

  constructor(text: string, params: StatementParams) {
    super();

    this.text = text;
    this.params = params;
  }

  public format(): string {
    return (<typeof Statement>this.constructor).escape(this.text, this.params).toString();
  }

}

/**
 * @param strings   Comment for `strings`
 */
export const erector = (strings, ...exps) => {
  //  // const string = strings.join('?');
  //  let strings_and_placeholders = [];
  //
  //  const lists = {};
  //
  //  for (let i = 0; i < exps.length; i += 1) {
  //    const exp = exps[i];
  //    if (typeof exp === 'function') {
  //      exp = exp();
  //    } else if (exp instanceof Statement) {
  //      exp = escape(exp.string, exp.params).toString();
  //    } else if (exp instanceof ListLabels || exps[i] instanceof ListValues) {
  //      const key = exp.name || undefined;
  //
  //      if (exp.content) {
  //        if (lists[key]) {
  //          // deep inequality is an error
  //        } else {
  //          lists[key] = exp;
  //        }
  //      } else if (!(key in lists)) {
  //        lists[key] = undefined;
  //      }
  //    }
  //  }
  //
  //  _.each(lists, (value, key) => {
  //    if (value === undefined) {
  //      // throw error for key
  //    }
  //  });
  //
  //  for (let i = 0; i < strings.length - 1; i += 1) {
  //    const exp = exps[i];
  //    const count = _.isArray(exp) ? _.size(exp) : 1;
  //
  //    console.log('count', count);
  //
  //    if (exp instanceof Raw) {
  //      strings_and_placeholders.push(strings[i]);
  //      strings_and_placeholders.push(exp.format());
  //    } else if (exp instanceof ListLabels || exp instanceof ListValues) {
  //      const key = exp.name;
  //      const { 
  //        content,
  //        array,
  //        object,
  //      } = lists[key].content; 
  //
  //      if (exp instanceof ListLabels) {
  //        const labels = exp.array ? exp.array : _.values(exp.object);
  //        // array of identifiers that should be escaped unless they are raw
  //      } else if (exp instanceof ListValues) {
  //        const values = exp.array ? exp.array : _.keys(exp.object);
  //        // array of literals that should be escaped unless they are raw
  //      }
  //    } else {
  //      if (strings[i][strings[i].length - 1] === '"' &&
  //          strings[i + 1][0] === '"') {
  //        strings_and_placeholders.push(strings[i].substring(0, strings[i].length - 1));
  //        strings_and_placeholders.push(_.range(count).map(() => '??').join(', '));
  //        strings[i + 1] = strings[i + 1].substring(1);
  //      } else {
  //        strings_and_placeholders.push(strings[i]);
  //        strings_and_placeholders.push(_.range(count).map(() => '?').join(', '));
  //      }
  //    }
  //
  //  }
  //
  //  return new Statement(
  //    strings_and_placeholders.join(''),
  //    _.flatten(_.filter(exps, (exp) => !(exp instanceof Raw))),
  //  );
}

export const raw: Function = erector.raw = SimpleQueryPart.make_template_factory(Raw);
export const i: Function = erector.identifier = SimpleQueryPart.make_template_factory(Identifier);
export const l: Function = erector.literal = SimpleQueryPart.make_template_factory(Literal);

// TODO: should this return a Statement?
erector.if = (test: any, pass: any, fail: any): any => {
  let is_pass = typeof test === 'function' ? test() : test;
  return is_pass ? pass : fail;
};

// TODO: types
// TODO: should this return a Statement?
erector.cmp_subquery = (a, ...args) => {
  const default_operator = args.length === 1;
  const operator = default_operator ? 'IN' : args[0];
  const b = default_operator ? args[0] : args[1];

  if (_.isUndefined(b) || _.isArray(b) && _.isEmpty(b)) {
    return '';
  } else {
    const parts = [];

    if (a instanceof QueryPart) {
      parts.push(a.format());
    } else {
      parts.push(escape('??', [a]));
    }

    parts.push(operator);

    let subquery;
    if (b instanceof QueryPart) {
      subquery = b.format();
    } else {
      subquery = _.map(b, (b_part) => new Literal(b_part).toString()).join(', ');
    }
    parts.push(`(${subquery})`);

    return parts.join(' ');
  }
};

// TODO: types
// TODO: should this return a Statement?
erector.cmp = (a, ...args) => {
  const default_operator = args.length === 1;
  const operator = default_operator ? '=' : args[0];
  const b = default_operator ? args[0] : args[1];

  if (_.isUndefined(b)) {
    // return an empty string because it's better for this to be excludeable in a template string
    return '';
  } else {
    const parts = [];

    if (a instanceof QueryPart) {
      parts.push(a.format());
    } else {
      parts.push(escape('??', [a]));
    }

    parts.push(operator);

    if (b instanceof QueryPart) {
      parts.push(b.format());
    } else {
      parts.push(escape('?', [b]));
    }

    return parts.join(' ');
  }
};
 
// TODO: should this return a Statement?
erector.and = (...exps: any[]): string => {
  return exps.filter((exp) => exp).join(' AND ');
};

// TODO: should this return a Statement?
erector.or = (...exps: any[]): string => {
  return exps.filter((exp) => exp).join(' OR ');
};

// // lol 😂
// erector.set = (object, options = {}) => {
//   if (_.isObject(object)) {
//     throw Error('not an object');
//   }
// 
//   const keys = _.sortBy(_.keys(object));
//   const assignments = _.map(keys, (key) => `${key}=${object[key]}`);
// 
//   const assignment = assignments.join(', ') || options.default || '';
// 
//   if (assignment) {
//     return [
//       options.leading_comma ? ', ' : '',
//       assignment,
//       options.trailing_comma ? ',' : '',
//     ].join('');
//   } else {
//     return assignment;
//   }
// };
// 
// erector.setdefined = (object, options = {}) => {
//   const definedObject = _.reduce(object, (acc, value, key) => {
//     if (value !== undefined) {
//       acc[key] = value;
//     }
//     return acc;
//   }, {});
// 
//   return this.set(definedObject, options);
// };

//sql.values = (...args) => {
//  const has_name = _.isString(args[0]);
//  const list = has_name ? args[1] : args[0];
//  const name = has_name ? args[0] : null;
//  return new ListValues(name, list);
//};
//
//sql.labels = (...args) => {
//  const has_name = _.isString(args[0]);
//  const list = has_name ? args[1] : args[0];
//  const name = has_name ? args[0] : null;
//  const is_array = _.isArray(list);
//  const array = is_array ? list : null;
//  const object = is_array ? null : list;
//  return new ListLabels(name, list, array, object);
//};
//

