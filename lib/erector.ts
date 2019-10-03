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

// https://www.bryntum.com/blog/the-mixin-pattern-in-typescript-all-you-need-to-know/
//
//export type AnyFunction<A = any> = (...input: any[]) => A;
//export type AnyConstructor<A = object> = new (...input: any[]) => A;
//export type Mixin<T extends AnyFunction> = InstanceType<ReturnType<T>>;
//
//export const KnexFormatted = <T extends AnyConstructor<object>>(base : T) => 
//  class KnexFormatted extends base {
//
//    abstract placeholder;
//    abstract value;
//
//    public format(): string {
//      return (<typeof KnexFormatted>this.constructor).escape(this.placeholder, this.value).toString();
//    }
//
//  };
// 
// export type KnexFormatted = Mixin<typeof KnexFormatted>;

export class Literal extends KnexFormattedSingleValueQueryPart {

  public placeholder = '?';

}
 
export class Identifier extends KnexFormattedSingleValueQueryPart {

  public placeholder = '??';

}

export abstract class List extends MultiValueQueryPart {

  public name?: string;
  public content?: any[] | object;
  public source?: List;

  constructor();
  constructor(content: any[] | object);
  constructor(name: string);
  constructor(name: string, content: any[] | object);
  constructor(...args: any[]) {
    super();

    if (_.isString(args[0])) {
      this.name = name;
    }

    for (let i = 0; i < args.length; i++) {
      if (_.isArray(args[i]) || _.isObject(args[i])) {
        this.content = args[i];
      }
    }
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
// const _resolve_function_recursively = (exp: StatementParam): StatementParam => {
//   while (typeof exp === 'function') {
//     exp = exp();
//   }
// 
//   return exp;
// }

/**
 * @param strings   Comment for `strings`
 */
export const erector = (strings: string[], ...exps: any[]) => {
//
//  // statement -> treat as raw w/ statement as value
//  // function -> eval... recursively?
//  // listlabels/values -> treat as statement
//  // arrays -> treat as statement
//
//  let text_parts: string[] = [];
//  let params: any[] = [];
//
//  const lists = {};
//  for (let i = 0; i < exps.length; i += 1) {
//    const exp = _resolve_function_recursively(exps[i]);
//
//    // if (exp instanceof ListLabels || exps instanceof ListValues) {
//    //   // TODO: list tracking -- but do it on the objects themselves
//    //   // const key = exp.name || undefined;
//    //   //  
//    //   // if (exp.content) {
//    //   //   if (lists[key]) {
//    //   //     // deep inequality is an error
//    //   //   } else {
//    //   //     lists[key] = exp;
//    //   //   }
//    //   // } else if (!(key in lists)) {
//    //   //   lists[key] = undefined;
//    //   // }
//    //
//    //   // TODO: how to construct statement
//    //   // exp = new Statement(...);
//    // }
//
//    if (exp instanceof Statement) {
//      exp = new Raw(exp);
//    }
//  }
//
//  // make sure lists are defined
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
//    const is_double_quoted  = strings[i][strings[i].length - 1] === '"' && strings[i + 1][0] === '"';
//    const is_identifier = is_double_quoted || exp instanceof Identifier;
//
//    if (exp instanceof e
//    
//    // pushing on as ?/??/??? with the value added to the list would...
//    // could also push the whole instance (e.g. Raw) and insert ???
//    // returning a single string ... no need for statements
//    if (exp instanceof QueryPart) {
//      // exp and strings may have nothing to do with one another, e.g.: 
//      //    SELECT * FROM "${foo}" will be broken down into 'SELECT FROM * "'
//      //    and foo
//      text_parts.push(strings[i]);
//      // this is always ???
//      text_parts.push(exp.placeholder);
//      params.push(exp.value);
//    } else if (exp instanceof Statement) {
//      text_parts.push('???');
//      params.push(exp);
//    //} else if (exp instanceof ListLabels || exp instanceof ListValues) {
//    //  const key = exp.name;
//    //  const { 
//    //    content,
//    //    array,
//    //    object,
//    //  } = lists[key].content; 
//    // 
//    //  if (exp instanceof ListLabels) {
//    //    const labels = exp.array ? exp.array : _.values(exp.object);
//    //    // array of identifiers that should be escaped unless they are raw
//    //  } else if (exp instanceof ListValues) {
//    //    const values = exp.array ? exp.array : _.keys(exp.object);
//    //    // array of literals that should be escaped unless they are raw
//    //  }
//    } else {
//      // default treatment is ?? within "" and ? otherwise
//      if (strings[i][strings[i].length - 1] === '"' &&
//          strings[i + 1][0] === '"') {
//        // push the beginning part of the string up to '"'
//        text_parts.push(strings[i].substring(0, strings[i].length - 1));
//        // push all of the placeholders onto the string
//        text_parts.push(_.range(count).map(() => '??').join(', '));
//        // trim the preceeding '"' from the next string
//        strings[i + 1] = strings[i + 1].substring(1);
//      } else {
//        // push the string as-is
//        text_parts.push(strings[i]);
//        // push all of the placeholders onto the string
//        text_parts.push(_.range(count).map(() => '?').join(', '));
//      }
//    }
//  
//  }
//  //  
//  //  return new Statement(
//  //    text_parts.join(''),
//  //    _.flatten(_.filter(exps, (exp) => !(exp instanceof Raw))),
//  //  );
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

