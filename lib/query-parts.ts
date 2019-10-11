import _ from 'lodash';

import { QueryPart } from './query-part-base';
import { escape } from './escape';

export abstract class QueryPartWithEscape extends QueryPart {

  static readonly escape = escape; 

}

// TODO: configuration option -> generate strings or Statements
// TODO: configuration option -> left operand default type is identifier
// TODO: configuration option -> .array to treat a array vs. .list to expand
// QUESTION: Object or object?

interface SingleValueQueryPartConstructor {
  new(value: any): SingleValueQueryPart;
}


export abstract class MultiValueQueryPart extends QueryPartWithEscape {

  public placeholder = '???';

  public param(): any {
    return this.format();
  }

}

export abstract class SingleValueQueryPart extends QueryPartWithEscape {

  public value: any;

  constructor(value: any) {
    super();

    this.value = value;
  }

  public param(): any {
    return this.value;
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
    return `${this.value}`;
  }
}

export abstract class EscapedSingleValueQueryPart extends SingleValueQueryPart {

  public format(): string {
    return (<typeof EscapedSingleValueQueryPart>this.constructor).escape(this.placeholder, this.value);
  }

}

export class Literal extends EscapedSingleValueQueryPart {

  public placeholder = '?';

}
 
export class Identifier extends EscapedSingleValueQueryPart {

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

  public set_source(source: List): void {
    // if (this.content && !_.isEqual(this.content, source.content)) {
    //   throw Error('content is already defined and source content differs');
    // }

    if (this.is_source()) {
      throw Error('cannot set the source of a source');
    }

    if (!source.is_source()) {
      throw Error('cannot set the source to be a non-source list');
    }

    if (this.name !== source.name) {
      throw Error(`source has a different name (${this.name} != ${source.name})`);
    }

    this.source = source;
  }

  public is_source(): boolean {
    return !_.isUndefined(this.content);
  }

  protected abstract content_to_placeholders_and_params(content: any[] | object): PlaceholderAndParams;

  public format(): string {

    if (!this.is_source() && (!this.source || !this.source.is_source())) {
      throw Error('No list source is available');
    }

    // we know this to be true
    const content = this.content || this.source!.content as any[] | object;

    const {
      placeholders,
      params,
    } = this.content_to_placeholders_and_params(content);

    return (<typeof List>this.constructor).escape(placeholders.join(', '), params);
  }

}

export interface PlaceholderAndParams {
  placeholders: string[],
  params: any[],
}

export class ListLabels extends List {

  protected content_to_placeholders_and_params(content: any[] | object): PlaceholderAndParams {

    const placeholders: string[] = [];
    const params: any[] = [];

    const labels = _.isArray(content) ? content : _.sortBy(_.keys(content));

    _.each(labels, (label: any) => {
      if (label instanceof QueryPart) {
        placeholders.push(label.placeholder);
        params.push(label.param());
      } else {
        placeholders.push('??');
        params.push(label);
      }
    });

    return {
      placeholders,
      params,
    };

  }

}

// TODO: should lists ignore undefined values?
export class ListValues extends List {

  protected content_to_placeholders_and_params(content: any[] | object): PlaceholderAndParams {

    const placeholders: string[] = [];
    const params: any[] = [];

    const values = _.isArray(content) ? content : _.sortBy(_.keys(content)).map((key: any) => (content as any)[key]);

    _.each(values, (value: any) => {
      if (value instanceof QueryPart) {
        placeholders.push(value.placeholder);
        params.push(value.param());
      } else {
        // TODO: access Literal.placeholder
        placeholders.push('?');
        params.push(value);
      }
    });

    return {
      placeholders,
      params,
    }; 

  }

}

// QUESTION: Does this really need to be so restrictive?
export type StatementParamFunction = (...args: any[]) => StatementParam;
export type StatementParam = string | number | boolean | QueryPart | StatementParamFunction;

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
    return (<typeof Statement>this.constructor).escape(this.text, this.params);
  }

}


