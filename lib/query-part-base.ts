
export abstract class QueryPart {

  // TODO(matt): placeholder is static
  public abstract placeholder: string;

  // param() is used when constructing Statements with QueryPart parameters.
  //
  // param() is equal to value() for single part query parts, but equal to format() for complex
  // query parts. That's because raw/literal/identifiers all get passed directly to escape with
  // their placeholder. More complex, multi-part query-parts need to be serialized as strings
  // before being passed to escape with the as-is placeholder (???)
  //
  // Statements created by the helpers in `erector` are shallow, meaning if we are constructing a
  // statement with a Literal, for example, we use the literal placeholder and the literal's param
  // value to construct a parameterized string and its input parameters. This is because we don't
  // need to keep the tree structure around, we just need to produce the final string output
  //
  // For example:
  //   cmp(new Literal('a'), new Identifier('b')) -> new Statment('? = ??', ['a', 'b'])
  //
  // The amount of string-creation for complex queries is probably pretty wasteful :/
  public abstract param(): any;

  // format() is used to stringify the query part
  public abstract format(): string;

  public toString(): string {
    return this.format();
  }

}

