const {
  escape,
  EscapeLiteral,
  WrapIdentifier, 
// should this be exported from the main module?
// } = require('/lib/erector');
} = require('/lib/escape');

const {
  Literal,
  Identifier,
  Raw,
} = require('/lib/query-parts');

const knex = require('knex')({ client: 'pg' });

describe('escape', () => {
  test('is exported function', () => {
    expect(escape).toEqual(expect.any(Function));
  });

  test('text is passed through', () => {
    expect(escape('the quick brown fox')).toBe('the quick brown fox');
  });

  test('escaped quotes are ignored', () => {
    expect(escape('the quick brown fox\\?')).toBe('the quick brown fox?');
  });

  test.each([
    [
      'errors when there are too many placeholders',
      '? ??',
      ['a'],
      'Expected 1 bindings, saw 2',
    ], [
      'errors when there are too few placeholders',
      '? ??',
      ['a', 'b', 'c'],
      'Expected 3 bindings, saw 2',
    ]
  ])('%p', (_name, text, params, expected) => {
    expect(() => escape(text, params)).toThrow(expected);
  });

  describe('literals', () => {
    test.each(['fox', ['fox']])('%p are single-quoted', (arg) => {
      expect(escape('the quick brown ?', arg)).toBe(`the quick brown 'fox'`);
    });

    test.each([`f'ox`, [`f'ox`]])('%p are escaped', (arg) => {
      expect(escape('the quick brown ?', arg)).toBe(`the quick brown 'f''ox'`);
    });

    test('named literals are supported', () => {
      expect(escape('the quick brown :animal', { animal: 'fox' })).toBe(`the quick brown 'fox'`);
    });
  });

  describe('identifiers', () => {
    test.each(['fox', ['fox']])('%p are double-quoted', (arg) => {
      expect(escape('the quick brown ??', arg)).toBe('the quick brown "fox"');
    });
    
    test.each(['fox.user', ['fox.user']])('%p are escaped', (arg) => {
      expect(escape('the quick brown ??', arg)).toBe('the quick brown "fox"."user"');
    });

    test('named identifiers are supported', () => {
      expect(escape('the quick brown :animal:', { animal: 'fox' })).toBe('the quick brown "fox"');
    });
  });

  describe('raw', () => {
    test('named raw identifiers are supported', () => {
      expect(escape('the quick brown ::animal::', { animal: 'fox()' })).toBe('the quick brown fox()');
    });
  });

  describe('knex parity', () => {
    test.each([[
      'insert into ?? (??, ??) values (?, ??)', 
      ['table', 'col1', 'col2', 'val1', 'val2'],
    ], [
      'update ?? set ??=?, ??=?',
      ['table', 'col1', 'val1', 'col2', 'val2'],
    ], [
      'value is null ?',
      [null],
    ], [
      'value is a boolean ?',
      [true],
    ], [
      'value is a number ?',
      [123],
    ], [
      'value is a string ?',
      ['abc'],
    ], [
      'value is an object ?',
      [{ a: 1, b: 'b', c: true, d: null }],
    ], [
      'value is an array ?',
      [['a', 2, true, null]],
    ], [
      'value is a nested array ?',
      [[['a', 2, true, null], ['b', 3, false]]],
    ], [
      'value is a nested object ?',
      [{ foo: true, bar: { a: 1 } }],
    ], [
      'value is a date ?',
      [new Date()],
    ], [
      'value is a buffer ?',
      [Buffer.from('deadbeef', 'hex')],
    ]])('%p', (string, params) => {
      expect(escape(string, params)).toBe(knex.raw(string, params).toString());
    });

    test.each([
      // this should probably be an error for knex but it is not
      [undefined, false],
      // TODO: fix this test
      // this is not an error for knex because it treats this as named parameters and ? is not significant
      // [{ a: undefined }, false],
      [[undefined], true],
      [[[undefined]], true],
      [[{ a: undefined }], true],
      [[[{ a: undefined }]], true],
    ])('undefined throws error (form: %p)', (input, knex_throws_too) => {
      const knex_fn = () => knex.raw('?', input).toString();

      if (knex_throws_too) {
        expect(knex_fn).toThrow();
      } else {
        expect(knex_fn).not.toThrow();
      }

      expect(() => escape('?', input)).toThrow();
    });
  });
});

describe('parameters', () => {
  test.each([
    ['\\:foo', ':foo'],
    ['\\:foo:', ':foo:'],
    ['\\::foo::', '::foo::'],
  ])('named parameters can be escaped: %p', (input, expected) => {
    expect(escape(input, { foo: 'bar' })).toBe(expected);
  });

  test('QueryParts are unwrapped', () => {
    expect(escape(':foo :bar: ::baz::', {
      foo: new Literal('a'),
      bar: new Identifier('b'),
      baz: new Raw('c()'),
    })).toBe(`'a' "b" c()`);
  });
});

describe('escape literals', () => {

  test.each([
    undefined,
    [undefined],
    { a: undefined },
    [{ a: undefined }],
    { a: [undefined] },
  ])('undefined is formatted as NULL in %p', (input) => {
    expect(EscapeLiteral.escape_value(input)).toBe(knex.client._escapeBinding(input));
  });

  test('functions are unwrapped', () => {
    expect(EscapeLiteral.escape_value(() => 'foo')).toBe(`'foo'`);
  });

});

describe('wrap identifier', () => {

  const formatter = knex.client.formatter(knex.client.queryBuilder());

  test.each([
    ['number', 1],
    ['string', 'foo'],
  ])('wrapping %p values is supported', (title, input) => {
    expect(WrapIdentifier.wrap(input)).toBe(formatter.wrap(input));
  });

  test.each([
    ['boolean', true],
    ['null', null],
    ['undefined', undefined],
    ['object', { a: 1 }],
    ['array', ['a', 1]],
    // ['bigint', 10n],
  ])('wrapping %p values is not supported', (title, input) => {
    expect(() => WrapIdentifier.wrap(input)).toThrow(`${typeof input} identifiers are not yet supported`);
  });

  test('functions can only be unwrapped once', () => {
    expect(() => WrapIdentifier.wrap(() => () => true)).toThrow('already unwrapped value once');
  });

  test('functions can be unwrapped', () => {
    expect(WrapIdentifier.wrap(() => 'foo')).toBe('"foo"');
  });


});
