const _ = require('lodash');
const knex = require('knex')({ client: 'pg' });
const assert = require('assert');

// TODO: configuration option -> generate strings or Statements
// TODO: configuration option -> left operand default type is identifier
// TODO: configuration option -> .array to treat a array vs. .list to expand
// QUESTION: Object or object?

/**
 * @param statement A SQL string with literal (?, :name) and identifier (??, :name:) placeholders
 * @param args      Single value, array of positional values, or object of named values
 */
export const escape = (statement: string, arg: any): string => knex.raw(statement, arg).toString();

interface SingleValueQueryPartConstructor {
  new(value: any): SingleValueQueryPart;
}

export abstract class QueryPart {

  static readonly escape = escape;

  public abstract placeholder: string;

  public abstract param(): string;
  public abstract format(): string;

  public toString(): string {
    return this.format();
  }

}

export abstract class MultiValueQueryPart extends QueryPart {

  public placeholder = '???';

  public param(): string {
    return this.format();
  }

}

export abstract class SingleValueQueryPart extends QueryPart {

  public value: any;

  constructor(value: any) {
    super();

    this.value = value;
  }

  public param(): string {
    return `${this.value}`;
  }

  public static make_template_factory(target_class: SingleValueQueryPartConstructor) {
    return (strings: string[], ...exps: any[]) => {
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

export class Raw extends SingleValueQueryPart {

  public placeholder = '???';

  public format(): string {
    return this.value;
  }
}

export abstract class KnexFormattedSingleValueQueryPart extends SingleValueQueryPart {

  public format(): string {
    return (<typeof KnexFormattedSingleValueQueryPart>this.constructor).escape(this.placeholder, this.value).toString();
  }

}

export class Literal extends KnexFormattedSingleValueQueryPart {

  public placeholder = '?';

}
 
export class Identifier extends KnexFormattedSingleValueQueryPart {

  public placeholder = '??';

}

export abstract class List extends MultiValueQueryPart {

  public name: string;
  public content?: any[] | object;
  public source?: List;

  constructor();
  constructor(content: any[] | object);
  constructor(name: string);
  constructor(name: string, content: any[] | object);
  constructor(...args: any[]) {
    super();

    this.name = _.isString(args[0]) ? args[0] : '_';

    for (let i = 0; i < args.length; i++) {
      if (_.isArray(args[i]) || _.isObject(args[i])) {
        this.content = args[i];
      }
    }
  }

  public is_source(): boolean {
    return !_.isUndefined(this.content);
  }

  public format(): string {
    return '';
  }

}

class ListLabels extends List {}

class ListValues extends List {}

// QUESTION: Does this really need to be so restrictive?
export type StatementParamFunction = (...args: any[]) => StatementParam;
export type StatementParam = string | number | boolean | QueryPart | StatementParamFunction;

// currently Statements === MultiValueQueryParts, but that may change
export class Statement extends MultiValueQueryPart {

  public readonly text: string;
  public readonly params: any[];

  constructor(text: string, params: any[]) {
    super();

    this.text = text;
    this.params = params;
  }

  public format(): string {
    // this actually needs to handle ???
    return (<typeof Statement>this.constructor).escape(this.text, this.params).toString();
  }

}


// // NOTE: exp is mutated
const _resolve_function_recursively = (exp: StatementParam): StatementParam => {
  while (typeof exp === 'function') {
    exp = exp();
  }

  return exp;
}

/**
 * @param strings   Comment for `strings`
 */
export const erector = (strings: string[], ...exps: any[]) => {

  let text_parts: string[] = [];
  let params: any[] = [];

  const list_sources: { [key: string]: List } = {};
  const list_references: { [key: string]: List[] } = {};

  for (let i = 0; i < exps.length; i += 1) {
    const exp = _resolve_function_recursively(exps[i]);

    if (exp instanceof List) {
      if (exp.is_source()) {
        if (list_sources[exp.name]) {
          if (!_.isEqual(exp, list_sources[exp.name])) {
            throw Error(`${exp.name} has two different values in this context`);
          }
        } else {
          list_sources[exp.name] = exp;
        }
      } else {
        if (!(exp.name in list_references)) {
          list_references[exp.name] = [];
        }

        list_references[exp.name].push(exp);
      }
    }
  }

  // make sure lists are defined
  _.each(list_references, (lists: List[], key: string) => {
    _.each(lists, (list: List) => {
      if (key in list_sources) {
        list.source = list_sources[key];
      } else {
        throw Error(`no source found for ${key}`);
      }
    });
  });

  for (let i = 0; i < strings.length - 1; i += 1) {
    const exp = exps[i];

    const current_string = strings[i];
    const next_string = strings[i + 1];
    const is_double_quoted  = current_string[current_string.length - 1] === '"' && next_string[0] === '"';

    // trim the double quote off of the right string so we can use it as-is next iteration
    // we do not need to modify the left string in-place
    if (is_double_quoted) {
      strings[i + 1] = next_string.substring(1);
    }

    // push the left/current string onto the text list
    text_parts.push(is_double_quoted ? current_string.substring(0, current_string.length - 1) : current_string);

    // push the placeholder for the current exp onto the text list
    text_parts.push(exp.placeholder);

    // push exp onto the param list, wrapping if double-quoted and not already an Identifier
    const wrap_with_identifier = is_double_quoted && !(exp instanceof Identifier);
    params.push(wrap_with_identifier ? new Identifier(exp) : exp);
  }

  return new Statement(
    text_parts.join(''),
    params
  );
}

export const raw: Function = erector.raw = SingleValueQueryPart.make_template_factory(Raw);
export const i: Function = erector.identifier = SingleValueQueryPart.make_template_factory(Identifier);
export const l: Function = erector.literal = SingleValueQueryPart.make_template_factory(Literal);

// TODO: should this return a Statement?
erector.if = (test: any, pass: any, fail: any): any => {
  let is_pass = typeof test === 'function' ? test() : test;
  // return pass or fail directly if QueryPart, otherwise Raw?
  return is_pass ? pass : fail;
};

const cmp_subquery: {
  (a: StatementParam, operator: string, b: StatementParam): Statement | string;
  (a: StatementParam, b: StatementParam): Statement | string;
} = (a: StatementParam, ...args: any[]) => {
  const default_operator = args.length === 1;
  const operator = default_operator ? 'IN' : args[0];
  const b_input = default_operator ? args[0] : args[1];
  const b_array = _.isArray(b_input) ? b_input : [b_input];

  // TODO: are these checks sufficient?
  // TODO: b_array is now guaranteed to be an array
  if (_.isUndefined(b_array) || _.isArray(b_array) && _.isEmpty(b_array)) {
    return '';
  } else {
    const text_parts: string[] = [];
    const params: any[] = [];

    if (a instanceof QueryPart) {
      text_parts.push(a.placeholder);
      params.push(a.param());
    } else {
      text_parts.push('??');
      params.push(a);
    }

    text_parts.push(operator);

    const b_parts: string[] = [];

    _.each(b_array, (b_element: any) => {
      if (b_element instanceof QueryPart) {
        b_parts.push(b_element.placeholder);
        params.push(b_element.param());
      } else {
        b_parts.push('?');
        params.push(b_element);
      }
    });

    text_parts.push(`(${b_parts.join(', ')})`);
    return new Statement(text_parts.join(' '), params);
  }
};

erector.cmp_subquery = cmp_subquery;

// should this "unpack" escaped query parts?
// this "unpacks" escaped query parts because it's nice for the query to not have a bunch of ??? -> literal ??? -> identifier...

// if a string, it's empty ''
const cmp: {
  (a: StatementParam, operator: string, b: StatementParam): Statement | string;
  (a: StatementParam, b: StatementParam): Statement | string;
} = (a: StatementParam, ...args: any[]): Statement | string => {
  const default_operator = args.length === 1;
  const operator = default_operator ? '=' : args[0];
  const b = default_operator ? args[0] : args[1];

  if (_.isUndefined(b)) {
    // return an empty string because it's better for this to be excludeable in a template string
    return '';
  } else {
    const text_parts: string[] = [];
    const params: any[] = [];

    if (a instanceof QueryPart) {
      text_parts.push(a.placeholder);
      params.push(a.param());
    } else {
      text_parts.push('??');
      params.push(a);
    }

    text_parts.push(operator);

    if (b instanceof QueryPart) {
      text_parts.push(b.placeholder);
      params.push(b.param());
    } else {
      text_parts.push('?');
      params.push(b);
    }

    return new Statement(text_parts.join(' '), params);
  }
};

erector.cmp = cmp;
 
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
  trailing_comma?: boolean;
  leading_comma?: boolean;
}

// lol 😂
erector.set = (obj: { [key: string]: any }, options: SetOptions = {}): Statement | string => {
  assert(_.isObject(obj), 'first parameter to set must be an object');

  const keys = _.sortBy(_.keys(obj));

  const text_parts: string[] = [];
  const params: any[] = [];

  _.each(keys, (key: any) => {
    const value = (<any>obj[key]);

    params.push(key);

    if (value instanceof QueryPart) {
      text_parts.push(`??=${value.placeholder}`);
      params.push(value.param());
    } else {
      text_parts.push('??=?');
      params.push(value);
    }
  });

  if (text_parts.length) {
    const text = [
      options.leading_comma ? ', ' : '',
      text_parts.join(', '),
      options.trailing_comma ? ',' : '',
    ].join('');

    return new Statement(text, params);
  } else {
    return '';
  }
};

erector.setdefined = (obj: object, options: SetOptions = {}): Statement | string => {
  const defined_object = _.reduce(obj, (acc: { [key: string]: any[] }, value: any, key: string) => {
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});

  // 'this' is defined as the module scope, not erector
  return erector.set(defined_object, options);
};

const values: {
  (): ListValues;
  (name: string): ListValues;
  (content: any[] | object): ListValues;
  (name: string, content: any[] | object): ListValues;
} = (...args: any[]) => {
  return new ListValues(args[0], args[1]);
}

erector.values = values;

const labels: {
  (): ListLabels;
  (name: string): ListLabels;
  (content: any[] | object): ListLabels;
  (name: string, content: any[] | object): ListLabels;
} = (...args: any[]) => {
  return new ListLabels(args[0], args[1]);
}

erector.labels = labels;

