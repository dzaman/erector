const {
  Identifier,
  Literal,
  Raw,

  List,
  ListValues,
  ListLabels,

  Statement,
} = require('/lib/query-parts');

const _ = require('lodash');

describe('query-parts', () => {
  describe('Raw', () => {
    test('text is passed through as-is', () => {
      expect((new Raw('Bobby; DROP "user"').format())).toBe('Bobby; DROP "user"');
    });
  });

  describe('Identifier', () => {
    test('text is escaped as an identifier', () => {
      expect((new Identifier('fox.user')).format()).toBe('"fox"."user"');
    });
  
  });
  
  describe('Literal', () => {
    test('text is escaped as a literal', () => {
      expect((new Literal(`F'oo`)).format()).toBe(`'F''oo'`);
    });
  });
  
  describe('List', () => {
    test.each([
      ListValues,
      ListLabels,
    ])('%p can be cloned', (class_ref) => {
      const original = new class_ref('foo', [1, 2, 3]);
      const clone = original.clone();
      expect(clone).not.toBe(original);
      expect(clone).toEqual(original);

      _.each(original.content, (value, key) => {
        expect(clone.content[key]).toBe(original.content[key]);
      });
    });

    describe.each([
      ListValues,
      ListLabels,
    ])('%p (shared)', (class_ref) => {
      test.each([
        // [constructor params, .name, .content, .is_source()]
        [[], '_', undefined, false],
        [['foo'], 'foo', undefined, false],
        [[['a']], '_', ['a'], true],
        [[{ a: 1 }], '_', { a: 1 }, true],
        [['foo', ['a']], 'foo', ['a'], true],
        [['foo', { a: 1 }], 'foo', { a: 1 }, true],
      ])('can be constructed with %p -> name: %p, content: %p, is_source: %p', (params, name, content, is_source) => {
        const list = new class_ref(...params);
        expect(list.name).toEqual(name);
        expect(list.content).toEqual(content);
        expect(list.is_source()).toEqual(is_source);
      });
  
      test.each([
        // [content, format()'s expected result]
        [[new Literal('a'), new Literal(2)], `'a', 2`],
        [[new Raw('foo()'), new Identifier('bar')], `foo(), "bar"`],
      ])('format with override %p -> %p', (content, expected) => {
        const list = new class_ref(content);
        expect(list.format()).toBe(expected);
      });
  
      test('errors when formatting without a source (no source)', () => {
        const list = new class_ref();
        expect(() => list.format()).toThrow('No list source is available');
      });
  
      test('errors when formatting without a source (source is not a source)', () => {
        const list = new class_ref();
        list.source = list;
        expect(() => list.format()).toThrow('No list source is available');
      });

    });
  
    describe('ListValues & ListLabels', () => {
      test.each([
        [ 
          // list a
          new ListValues([1, 2, 3]),
          // list b
          new ListValues([1, 2, 3]),
          // a.is_content_equal(b)
          true,
        ], [
          new ListLabels([1, 2, 3]),
          new ListLabels([1, 2, 3]),
          true,
        ], [
          new ListLabels({ a: 1, b: 2 }),
          new ListLabels({ a: 1, b: 2 }),
          true,
        ], [
          new ListValues({ a: 1, b: 2 }),
          new ListValues({ a: 1, b: 2 }),
          true,
        ], [
          new ListLabels([1, 2, 3]),
          new ListValues([1, 2, 3]),
          true,
        ], [
          new ListLabels({ a: 1, b: 2 }),
          new ListValues({ a: 1, b: 2 }),
          true,
        ], [
          new ListLabels([1, 2, 3]),
          new ListLabels([1, 2]),
          false,
        ], [
          new ListValues([1, 2, 3]),
          new ListValues([1, 2]),
          false,
        ], [
          new ListValues({ a: 1, b: 2 }),
          new ListValues({ a: 1 }),
          false,
        ], [
          new ListLabels({ a: 1, b: 2 }),
          new ListLabels({ a: 1 }),
          false,
        ], [
          new ListLabels([1, 2, 3]),
          new ListValues([1, 2]),
          false,
        ], [
          new ListLabels({ a: 1, b: 2 }),
          new ListValues({ a: 1 }),
          false,
        ], [
          new ListLabels(),
          new ListLabels([1]),
          false,
        ], [
          new ListValues([1]),
          new ListValues(),
          false,
        ], [
          new ListLabels(),
          new ListValues(),
          false,
        ], [
          new ListLabels([1, 2, 3]),
          new ListValues({ a: 1, b: 2 }),
          false,
        ],
      ])('is_content_equal %p %p', (a, b, expected) => {
        expect(a.is_content_equal(b)).toBe(expected);
      });
    });
  
    describe('ListValues', () => {
      test.each([
        [
          // list labels constructor params
          ['a', 'b'],
          // expeced result of format()
          `'a', 'b'`
        ], [
          { a: 1, b: 2 },
          `1, 2`
        ], [
          [new Literal('a'), new Literal(2)],
          `'a', 2`
        ], [
          { a: new Literal('a'), b: new Literal(2) },
          `'a', 2`
        ], [
          [new Raw('foo()'), new Identifier('bar')],
          `foo(), "bar"`
        ], [
          { a: new Raw('foo()'), b: new Identifier('bar') },
          `foo(), "bar"`
        ],
      ])('format with default %p -> %p', (content, expected) => {
        const list = new ListValues(content);
        expect(list.format()).toBe(expected);
      });
    });
  
    describe('ListLabels', () => {
      test.each([
        [
          // list labels constructor params
          ['a', 'b'],
          // expeced result of format()
          '"a", "b"',
        ], [
          { a: 1, b: 2 },
          '"a", "b"',
        ], [
          [new Literal('a'), new Literal(2)],
          `'a', 2`,
        ], [
          { a: new Literal('a'), b: new Literal(2) },
          `"a", "b"`,
        ], [
          [new Raw('foo()'), new Identifier('bar')],
          `foo(), "bar"`,
        ], [
          { a: new Raw('foo()'), b: new Identifier('bar') },
          `"a", "b"`,
        ],
      ])('format %p -> %p', (content, expected) => {
        const list = new ListLabels(content);
        expect(list.format()).toBe(expected);
      });
    });
  
    describe('ListValues & ListLabels', () => {
      test.each([
        [
          new ListLabels(),
          new ListValues({ a: 1, b: 2 }),
          '"a", "b"',
        ], [
          new ListValues(),
          new ListLabels({ a: 1, b: 2 }),
          `1, 2`,
        ],
      ])('%o come from %o source', (target, source, expected) => {
        target.set_source(source);
        expect(target.format()).toBe(expected);
      });
  
      test.each([
        [
          'cannot set the source of a source', 
          new ListValues([true]),
          new ListValues([true]),
          undefined,
        ], [
          'cannot set the source to be a non-source list',
          new ListValues(),
          new ListValues(),
          undefined,
        ], [
          'cannot set the source for a different name',
          new ListValues('foo'),
          new ListValues('bar', [true]),
          'source has a different name (foo != bar)',
        ]
      ])('%p', (name, destination, source, custom_expected) => {
        const expected = custom_expected ? custom_expected : name;
        expect(() => destination.set_source(source)).toThrow(expected);
      });
  
    });
  
  });
  
});
