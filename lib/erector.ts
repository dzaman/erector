const _ = require('../vendor/lodash.custom.js');
import assert from 'assert';

import { QueryPart } from './query-part-base';

import {
  Identifier,
  List,
  ListLabels,
  ListValues,
  Literal,
  Raw,
  SingleValueQueryPart,
  Statement,
  StatementParam,
} from './query-parts';

export class Erector {

  // NOTE: exp is mutated
  protected static _resolve_function_recursively(exp: StatementParam): StatementParam {
    while (typeof exp === 'function') {
      exp = exp();
    }

    return exp;
  }

  /**
   * @param strings   Comment for `strings`
   */
  public static template(_strings: string[], ..._exps: any[]) {
    const strings: string[] = _.clone(_strings);
    const exps: any[] = _.clone(_exps);

    // return _generate_statement(
    //   strings,
    //   _set_list_sources(
    //     _resolve_functions_recursively(exps)
    //   )
    // );

    let text_parts: string[] = [];
    let params: any[] = [];

    const list_sources: { [key: string]: List } = {};
    const list_references: { [key: string]: List[] } = {};

    for (let i = 0; i < exps.length; i += 1) {
      const exp = exps[i] = this._resolve_function_recursively(exps[i]);

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
          list.set_source(list_sources[key]);
        } else {
          throw Error(`No source found for ${key}`);
        }
      });
    });

    for (let i = 0; i < strings.length - 1; i += 1) {
      const exp = exps[i];

      const current_string = strings[i];
      const next_string = strings[i + 1];
      const is_double_quoted = current_string[current_string.length - 1] === '"' && next_string[0] === '"';

      // trim the double quote off of the right string so we can use it as-is next iteration
      // we do not need to modify the left string in-place
      if (is_double_quoted) {
        strings[i + 1] = next_string.substring(1);
      }

      // push the left/current string onto the text list
      text_parts.push(is_double_quoted ? current_string.substring(0, current_string.length - 1) : current_string);

      // TODO: access ? from Literal
      // push the placeholder for the current exp onto the text list
      const placeholder = is_double_quoted ? '??' : '?';
      text_parts.push(exp instanceof QueryPart ? exp.placeholder : placeholder);

      // push exp onto the param list, wrapping if double-quoted and not already an Identifier
      // don't prevent double-wrapping magically 
      // const wrap_with_identifier = is_double_quoted && !(exp instanceof Identifier);
      params.push(is_double_quoted ? new Identifier(exp) : exp);
    }

    text_parts.push(strings[strings.length - 1]);

    return new Statement(
      text_parts.join(''),
      params
    );
  }

  // TODO: should this return a Statement?
  public static if(test: any, pass: any, fail: any): any { 
    let is_pass = typeof test === 'function' ? test() : test;
    // return pass or fail directly if QueryPart, otherwise Raw?
    return is_pass ? pass : fail;
  }

  public static cmp_subquery(a: StatementParam, operator: string, b: StatementParam): Statement | string;
  public static cmp_subquery(a: StatementParam, b: StatementParam): Statement | string;
  public static cmp_subquery(a: StatementParam, ...args: any[]): Statement | string {
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
  }

  // should this "unpack" escaped query parts?
  // this "unpacks" escaped query parts because it's nice for the query to not have a bunch of ??? -> literal ??? -> identifier...

  // if a string, it's empty ''
  public static cmp(a: StatementParam, operator: string, b: StatementParam): Statement | string;
  public static cmp(a: StatementParam, b: StatementParam): Statement | string;
  public static cmp(a: StatementParam, ...args: any[]): Statement | string {
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
  }

  // NOTE: This does not "unpack" escaped expressions (literals, etc.) because we expect exps to all be raw.
  // If literals are passed in, it will pass those, escaped, through ???, so they will work as-expected.
  public static and(...exps: any[]): Statement {
    const filtered_exps = exps.filter((exp) => exp);
    const text = filtered_exps.map(() => '???').join(' AND ');
    return new Statement(text, filtered_exps);
  }

  public static or(...exps: any[]): Statement {
    const filtered_exps = exps.filter((exp) => exp);
    const text = filtered_exps.map(() => '???').join(' OR ');
    return new Statement(text, filtered_exps);
  }

  // lol 😂
  public static set(obj: { [key: string]: any }, options: SetOptions = {}): Statement | string { 
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
  }

  public static setdefined(obj: object, options: SetOptions = {}): Statement | string {
    const defined_object = _.reduce(obj, (acc: { [key: string]: any[] }, value: any, key: string) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {});

    return this.set(defined_object, options);
  }

  public static values(): ListValues;
  public static values(name: string): ListValues;
  public static values(content: any[] | object): ListValues;
  public static values(name: string, content: any[] | object): ListValues;
  public static values(...args: any[]) {
    return new ListValues(args[0], args[1]);
  }

  public static labels(): ListLabels;
  public static labels(name: string): ListLabels;
  public static labels(content: any[] | object): ListLabels;
  public static labels(name: string, content: any[] | object): ListLabels;
  public static labels(...args: any[]): ListLabels {
    return new ListLabels(args[0], args[1]);
  }
}

/**
 * @param strings   Comment for `strings`
 */
export function erector(strings: string[], ...exps: any[]): Statement {
  return Erector.template(strings, ...exps);
}

export interface SetOptions {
  trailing_comma?: boolean;
  leading_comma?: boolean;
}

export namespace erector {
  export const raw = SingleValueQueryPart.make_template_factory(Raw);
  export const identifier: Function = SingleValueQueryPart.make_template_factory(Identifier);
  export const i = identifier;
  export const literal = SingleValueQueryPart.make_template_factory(Literal);
  export const l = literal;

  export let condition = Erector.if;
  export const cmp_subquery = Erector.cmp_subquery;
  export const cmp = Erector.cmp;
  export const and = Erector.and;
  export const or = Erector.or;
  export const set = Erector.set;
  export const setdefined = Erector.setdefined;
  export const values = Erector.values;
  export const labels = Erector.labels;
}

export const raw = erector.raw;
export const i = erector.i;
export const identifier: Function = erector.identifier;
export const l = erector.l;
export const literal = erector.literal;

export const condition = erector.condition;

export const cmp = erector.cmp;
export const cmp_subquery = erector.cmp_subquery;

// lol 😂
export const set = erector.set;
export const setdefined = erector.setdefined;

export const and = erector.and;
export const or = erector.or;

export const values = erector.values;
export const labels = erector.labels;

// make `if` an alias for `condition`
erector.if = erector.condition;
export { condition as if };

