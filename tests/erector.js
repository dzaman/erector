const {
  e,
  erector,

  i,
  l,
  raw,

  labels,
  values,

  Identifier,
  Literal,
  Raw,

  ListValues,
  ListLabels,

  Statement,
} = require('/lib/erector');

const erector_module = require('/lib/erector');

describe('erector', () => {
  describe('module exports', () => {
    test('erector is a function', () => {
      expect(erector_module.erector).toEqual(expect.any(Function));
    });

    test.each([
      'if',
      'condition',
      'and',
      'or',
      'cmp_subquery',
      'cmp',
      'set',
      'setdefined',
      'labels',
      'values',
      'raw',
      'identifier',
      'i',
      'literal',
      'l',
      // 'Literal',
      // 'Identifier',
      // 'Statement',
      // 'List',
      // 'ListValues',
      // 'ListLabels',
      // 'Raw',
    ])('%p is a function', (name) => {
      expect(erector_module[name]).toEqual(expect.any(Function));
      expect(erector_module.erector[name]).toEqual(expect.any(Function));
    });
  });
  
  describe('erector', () => {
    describe('template', () => {
      test.each([
        ['placeholder at end', erector`hello ${'world'}`, `hello 'world'`],
        ['placeholder in between', erector`hello ${'world'}!`, `hello 'world'!`],
        ['placeholder at beginning', erector`${'goodbye'} world`, `'goodbye' world`],
        ['identifier override', erector`hello ${i`world`}`, `hello "world"`],
        ['double quotes trigger identifier override', erector`hello "${'world as w'}"`, `hello "world" as "w"`],
        ['lists values are expanded', erector`goodbye ${values(['cruel', 'world'])}`, `goodbye 'cruel', 'world'`],
        ['lists labels are expanded', erector`goodbye ${labels(['cruel', 'world'])}`, `goodbye "cruel", "world"`],
        ['lists values and labels are linked', erector`insert into (${labels()}) values (${values({ a: 'foo', b: 'bar' })})`, `insert into ("a", "b") values ('foo', 'bar')`],
        ['functions are resolved', erector`hello ${() => 'world'}`, `hello 'world'`],
      ])('%p', (_name, result, expected) => {
        expect(result.toString()).toBe(expected);
      });

      test.each([
        ['sources both defined and the same is ok', () => { erector`insert into (${labels('foo', [1])}) values (${values('foo', [1])})` }]
      ])('%p', (_name, fn) => {
        expect(fn).not.toThrowError();
      });

      test.each([
        ['multiple references to the same source is ok', () => { erector`insert into (${labels('foo', [1])}) values ((${values('foo')}), (${values('foo')}))` }]
      ])('%p', (_name, fn) => {
        expect(fn).not.toThrowError();
      });
  
      test.each([
        ['sources, if both defined, must be the same', () => { erector`insert into (${labels('foo', [1])}) values (${values('foo', [2])})` }, 'foo has two different values in this context'],
        ['sources must be defined', () => { erector`insert into (${labels('foo')}) values (${values('bar')})` }, 'No source found for foo'],
      ])('%', (_name, fn, expected) => {
        expect(fn).toThrowError(expected);
      });
    });
  
    describe('if', () => {
      test.each([
        [true, 'a', 'b', 'a'],
        [false, 'a', 'b', 'b'],
        ['truthy', 'a', 'b', 'a'],
        ['', 'a', 'b', 'b'],
        [{ a: 1 }, 'a', 'b', 'a'],
        [[1], 'a', 'b', 'a'],
      ])('if(%p, %p, %p) -> %p', (test, a, b, result) => {
        expect(erector.if(test, a, b)).toStrictEqual(result);
        expect(erector.if(() => test, a, b)).toStrictEqual(result);
      });
    });
  
    ['and', 'or'].forEach((operator) => {
      const operator_upper = operator.toUpperCase();
  
      describe(operator, () => {
        test.each([
          [
            ['', 'a', 'b', 'c'],
            new Statement(`??? ${operator_upper} ??? ${operator_upper} ???`, ['a', 'b', 'c'])
          ],
          [
            [0, 1, 2, 3],
            new Statement(`??? ${operator_upper} ??? ${operator_upper} ???`, [1, 2, 3])
          ],
          [
            [true, false, undefined, null],
            new Statement('???', [true])
          ],
          [
            [new Literal('a'), new Identifier('b'), new Raw('c')],
            new Statement(`??? ${operator_upper} ??? ${operator_upper} ???`, [
              new Literal('a'),
              new Identifier('b'),
              new Raw('c'),
            ])
          ],
        ])(`${operator}(%p) -> %p`, (parts, result) => {
          expect(erector[operator](...parts)).toStrictEqual(result);
        });
      });
    });
  
    // TODO: make sure all comparisons are supported
    // comparisons - https://www.postgresql.org/docs/9.5/functions-comparison.html
    //    - between
    //    - null/not null
    describe('cmp', () => {
      test(`operator is defaulted to '='`, () => {
        expect(erector.cmp('a', 'b')).toStrictEqual(new Statement('?? = ?', ['a', 'b']));
      });
  
      test('operator can be overridden', () => {
        expect(erector.cmp('a', '!=', 'b')).toStrictEqual(new Statement('?? != ?', ['a', 'b']));
      });
  
      test('undefined right operand results in empty string', () => {
        expect(erector.cmp('a', undefined)).toBe('');
        expect(erector.cmp('a', '=', undefined)).toBe('');
      });
  
      describe('operand types', () => {
        test('operands are interpreted as identifiers and literals, respectively', () => {
          expect(
            erector.cmp('a', '=', 'b')
          )
          .toStrictEqual(
            new Statement('?? = ?', ['a', 'b'])
          );
        });
  
        test('left operand can be defined as literal', () => {
          expect(erector.cmp(l`a`, '=', 'b')).toStrictEqual(new Statement('? = ?', ['a', 'b']));
        });
        
        test('left operand can be defined as raw', () => {
          expect(erector.cmp(raw`a`, '=', 'b')).toStrictEqual(new Statement('??? = ?', ['a', 'b']));
        });
  
        test('right operand can be defined as an identifier', () => {
          expect(erector.cmp('a', '=', i`b`)).toStrictEqual(new Statement('?? = ??', ['a', 'b']));
        });
  
        test('right operand can be defined as raw', () => {
          expect(erector.cmp('a', '=', raw`b`)).toStrictEqual(new Statement('?? = ???', ['a', 'b']));
        });
      });
    });
  
    describe('cmp_subquery', () => {
      // TODO: make sure all subqueries are supported
      // subqueries - https://www.postgresql.org/docs/11/functions-subquery.html#FUNCTIONS-SUBQUERY-EXISTS
      //    - in
      //    - any
      //    - all
      //    - some
      test(`operator is defaulted to 'in'`, () => {
        expect(
          erector.cmp_subquery('a', ['b'])
        )
        .toStrictEqual(
          new Statement('?? IN (?)', ['a', 'b'])
        );
      });
  
      test('operator can be overridden', () => {
        expect(
          erector.cmp_subquery('a', 'NOT IN', ['b'])
        )
        .toStrictEqual(
          new Statement('?? NOT IN (?)', ['a', 'b']) 
        );
      });
  
      test('returns empty string if list is empty', () => {
        expect(
          erector.cmp_subquery('a', [])
        )
        .toBe('')
      });
  
      test('left operand can be literal', () => {
        expect(
          erector.cmp_subquery(l`a`, ['b'])
        )
        .toStrictEqual(
          new Statement('? IN (?)', ['a', 'b'])
        );
      });
  
      test('right operand can be identifier or raw', () => {
        expect(
          erector.cmp_subquery('a', [i`b`, raw`c()`])
        )
        .toStrictEqual(
          new Statement(`?? IN (??, ???)`, ['a', 'b', 'c()'])
        );
      });
  
      test('right operand is converted to an array if it is not', () => {
        expect(
          erector.cmp_subquery('a', 'b')
        )
        .toStrictEqual(
          new Statement('?? IN (?)', ['a', 'b'])
        );
      });
    });
  
    describe.each([
      'set',
      'setdefined',
    ])('%p (shared functionality)', (method) => {
      test.skip('first parameter must be an object', () => {
        expect(erector[method]('not-an-object')).toStrictEqual(false);
      });
  
      test('an empty object returns an empty string', () => {
        expect(erector[method]({})).toBe('');
      });
  
      test.each([
        [{ a: 1 }, '??=?', ['a', 1]],
        [{ a: 1, b: 'foo' }, '??=?, ??=?', ['a', 1, 'b', 'foo']],
        [{ a: 1, b: 'foo', c: true }, '??=?, ??=?, ??=?', ['a', 1, 'b', 'foo', 'c', true]],
        [{ a: 1, b: 'foo', c: true, d: null }, '??=?, ??=?, ??=?, ??=?', ['a', 1, 'b', 'foo', 'c', true, 'd', null]],
      ])('all object keys are translated to assignments: %p', (obj, text, params) => {
        const actual = erector[method](obj);
        const expected = new Statement(text, params);
        expect(actual).toStrictEqual(expected);
      });
  
      test('literal values are supported (these are the default)', () => {
        const actual = erector[method]({ a: l`foo` });
        const expected = new Statement('??=?', ['a', 'foo']);
        expect(actual).toStrictEqual(expected);
      });
  
      test('identifier values are supported', () => {
        const actual = erector[method]({ a: i`foo` });
        const expected = new Statement('??=??', ['a', 'foo']);
        expect(actual).toStrictEqual(expected);
      });
  
      test('raw values are supported', () => {
        const actual = erector[method]({ a: raw`foo` });
        const expected = new Statement('??=???', ['a', 'foo']);
        expect(actual).toStrictEqual(expected);
      });
  
      test.each([
        { leading_comma: true },
        { trailing_comma: true },
        { leading_comma: true, trailing_comma: true },
      ])('will not append %p if there are no assignments', (options) => {
        const actual = erector[method]({}, options);
        expect(actual).toBe('');
      });
  
      test.each([
        [{ leading_comma: true }, ', ??=?'],
        [{ trailing_comma: true }, '??=?,'],
        [{ leading_comma: true, trailing_comma: true }, ', ??=?,'],
      ])('will append %p if there are assignments', (options, text) => {
        const actual = erector[method]({ a: 1 }, options);
        const expected = new Statement(text, ['a', 1]);
        expect(actual).toStrictEqual(expected);
      });
    });
  
    describe('set', () => {
      test.each([
        [{ a: undefined }, '??=?', ['a', undefined]],
        [{ a: undefined, b: 'foo' }, '??=?, ??=?', ['a', undefined, 'b', 'foo']],
      ])('undefined values can be set: %p', (obj, text, params) => {
        expect(
          erector.set(obj)
        )
        .toStrictEqual(
          new Statement(text, params)
        );
      });
    });
  
    describe('setdefined', () => {
      test.each([
        [{ a: undefined }, ''],
        [{ a: undefined, b: 'foo' }, new Statement('??=?', ['b', 'foo'])],
        [{ a: undefined, b: 'foo', c: undefined }, new Statement('??=?', ['b', 'foo'])],
      ])('undefined values are ignored: %p', (obj, expected) => {
        expect(
          erector.setdefined(obj)
        )
        .toStrictEqual(expected);
      });
    });
  
    describe('Literal/l/literal', () => {
  
      test('exports l and erector.literal', () => {
        expect(l).toBe(erector.literal);
        expect(l).toEqual(expect.any(Function));
        expect(erector.literal).toEqual(expect.any(Function));
      });

      test('new Literal()', () => {
        expect(l`F'oo`).toStrictEqual(new Literal(`F'oo`));
      });
    
      test('supports templates', () => {
        expect(l`x ${'y'} z`).toStrictEqual(new Literal('x y z'));
      });
    });

    describe('Identifier/i/identifier', () => {
      test('also exported as i and erector.identifier', () => {
        expect(i).toBe(erector.identifier);
        expect(i).toEqual(expect.any(Function));
        expect(erector.identifier).toEqual(expect.any(Function));
      });
    
      test('i/identifier equls new Identifier()', () => {
        expect(i`fox.user`).toStrictEqual(new Identifier('fox.user'));
      });
    
      test('i supports templates', () => {
        expect(i`x ${'y'} z`).toStrictEqual(new Identifier('x y z'));
      });
    });

    describe('Raw/raw', () => {
      test('is exported as a class', () => {
        expect(Raw).toEqual(expect.any(Function));
      });
    
      test('raw supports templates', () => {
        expect(raw`x ${'y'} z`).toStrictEqual(new Raw('x y z'));
      });
    });
  });
});
