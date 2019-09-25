const _ = require('lodash');
const knex = require('knex')({ client: 'pg' });
const assert = require('assert');


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

  static readonly escape = escape;

  public abstract format(): string;

  // public abstract text(): string;
  // public abstract values(): any[];

  public toString(): string {
    return this.format();
  }

}

export abstract class EscapedQueryPart extends QueryPart {

  public readonly value: any;
  public readonly abstract placeholder: string;

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

export class Raw extends EscapedQueryPart {

  public placeholder = '???';
  
  public format(): string {
    return this.value.toString();
  }

}

export class Literal extends EscapedQueryPart {

  public placeholder = '?';

  public format(): string {
    return (<typeof Literal>this.constructor).escape('?', this.value).toString();
  }

}
 
export class Identifier extends EscapedQueryPart {

  public placeholder = '??';

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

// QUESTION: Does this really need to be so restrictive?
export type StatementParam = string | number | boolean | QueryPart;

export class Statement extends QueryPart {

  protected text: string;
  protected params: StatementParam[];

  constructor(text: string, params: StatementParam[] = []) {
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

export const raw: Function = erector.raw = EscapedQueryPart.make_template_factory(Raw);
export const i: Function = erector.identifier = EscapedQueryPart.make_template_factory(Identifier);
export const l: Function = erector.literal = EscapedQueryPart.make_template_factory(Literal);

// TODO: should this return a Statement?
erector.if = (test: any, pass: any, fail: any): any => {
  let is_pass = typeof test === 'function' ? test() : test;
  // return pass or fail directly if QueryPart, otherwise Raw?
  return is_pass ? pass : fail;
};

// TODO: types
erector.cmp_subquery = (a, ...args) => {
  const default_operator = args.length === 1;
  const operator = default_operator ? 'IN' : args[0];
  const b_input = default_operator ? args[0] : args[1];
  const b_array = _.isArray(b_input) ? b_input : [b_input];

  // TODO: are these checks sufficient?
  // TODO: b_array is now guaranteed to be an array
  if (_.isUndefined(b_array) || _.isArray(b_array) && _.isEmpty(b_array)) {
    return '';
  } else {
    const text_parts = [];
    const params = [];

    if (a instanceof EscapedQueryPart) {
      text_parts.push(a.placeholder);
      params.push(a.value);
    } else {
      text_parts.push('??');
      params.push(a);
    }

    text_parts.push(operator);

    const b_parts = [];

    _.each(b_array, (b_element) => {
      if (b_element instanceof EscapedQueryPart) {
        b_parts.push(b_element.placeholder);
        params.push(b_element.value);
      } else {
        b_parts.push('?');
        params.push(b_element);
      }
    });

    text_parts.push(`(${b_parts.join(', ')})`);
    return new Statement(text_parts.join(' '), params);
  }
};

// should this "unpack" escaped query parts?
// this "unpacks" escaped query parts because it's nice for the query to not have a bunch of ??? -> literal ??? -> identifier...

// if a string, it's empty ''
// TODO: types
erector.cmp = (a, ...args): Statement | string => {
  const default_operator = args.length === 1;
  const operator = default_operator ? '=' : args[0];
  const b = default_operator ? args[0] : args[1];

  if (_.isUndefined(b)) {
    // return an empty string because it's better for this to be excludeable in a template string
    return '';
  } else {
    const text_parts = [];
    const params = [];

    if (a instanceof EscapedQueryPart) {
      text_parts.push(a.placeholder);
      params.push(a.value);
    } else {
      text_parts.push('??');
      params.push(a);
    }

    text_parts.push(operator);

    if (b instanceof EscapedQueryPart) {
      text_parts.push(b.placeholder);
      params.push(b.value);
    } else {
      text_parts.push('?');
      params.push(b);
    }

    return new Statement(text_parts.join(' '), params);
  }
};
 
// NOTE: This does not "unpack" escaped expressions (literals, etc.) because we expect exps to all be raw.
// If literals are passed in, it will pass those, escaped, through ???, so they will work as-expected.
erector.and = (...exps: any[]): Statement => {
  const filtered_exps = exps.filter((exp) => exp);
  const text = filtered_exps.map(() => '???').join(' AND ');
  return new Statement(text, filtered_exps);
};

erector.or = (...exps: any[]): Statement => {
  const filtered_exps = exps.filter((exp) => exp);
  const text = filtered_exps.map(() => '???').join(' OR ');
  return new Statement(text, filtered_exps);
};

export interface SetOptions {
  default?: string;
  trailing_comma?: boolean;
  leading_comma?: boolean;
}

// lol 😂
erector.set = (obj: Object, options: SetOptions = {}): Statement | string => {
  assert(_.isObject(obj), 'first parameter to set must be an object');

  const keys = _.sortBy(_.keys(obj));

  const text_parts = [];
  const params = [];

  _.each(keys, (key) => {
    const value = obj[key];

    params.push(key);

    if (value instanceof EscapedQueryPart) {
      text_parts.push(`??=${value.placeholder}`);
      params.push(value.value);
    } else {
      text_parts.push('??=?');
      params.push(value);
    }
  });

  const assignment = text_parts.join(', ') || options.default;

  if (assignment) {
    const text = [
      options.leading_comma ? ', ' : '',
      assignment,
      options.trailing_comma ? ',' : '',
    ].join('');

    return new Statement(text, params);
  } else {
    return '';
  }
};

erector.setdefined = (obj: Object, options: SetOptions = {}): Statement | string => {
  const defined_object = _.reduce(obj, (acc, value, key) => {
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});

  // 'this' is defined as the module scope, not erector
  return erector.set(defined_object, options);
};

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

