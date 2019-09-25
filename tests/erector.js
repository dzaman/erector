const _ = require('lodash');

const {
  e,
  erector,
  escape,

  Identifier,
  Literal,
  Raw,

  i,
  l,
  raw,

  Statement,
} = require('../lib/erector');

describe('escape', () => {
  test('is exported function', () => {
    expect(escape).toEqual(expect.any(Function));
  });

  test('text is passed through', () => {
    expect(escape('the quick brown fox')).toBe('the quick brown fox');
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

    // TODO: delete this test
    test.skip('literals get special treatment in parentheses', () => {
      expect(escape('the quick (?)', [['brown', 'animal']])).toBe(`the quick ('brown', 'animal')`);
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
});

describe('Raw', () => {
  test('is exported as a class', () => {
    expect(Raw).toEqual(expect.any(Function));
  });

  test('text is passed through as-is', () => {
    expect((new Raw('Bobby; DROP "user"').format())).toBe('Bobby; DROP "user"');
  });
});

describe('Identifier', () => {
  test('is exported as a class', () => {
    expect(Identifier).toEqual(expect.any(Function));
  });

  test('text is escaped as an identifier', () => {
    expect((new Identifier('fox.user')).format()).toBe('"fox"."user"');
  });

  test('also exported as i and erector.identifier', () => {
    expect(i).toBe(erector.identifier);
    expect(i).toEqual(expect.any(Function));
    expect(erector.identifier).toEqual(expect.any(Function));
  });

  test('i/identifier equls new Identifier()', () => {
    expect(i`fox.user`).toStrictEqual(new Identifier('fox.user'));
  });
});

describe('Literal', () => {
  test('is exported as a class', () => {
    expect(Identifier).toEqual(expect.any(Function));
  });

  test('text is escaped as a literal', () => {
    expect((new Literal(`F'oo`)).format()).toBe(`'F''oo'`);
  });

  test('also exported as l and erector.literal', () => {
    expect(l).toBe(erector.literal);
    expect(l).toEqual(expect.any(Function));
    expect(erector.literal).toEqual(expect.any(Function));
  });

  test('l/literal equals new Literal()', () => {
    expect(l`F'oo`).toStrictEqual(new Literal(`F'oo`));
  });
});

describe('erector', () => {

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

  _.each(['and', 'or'], (operator) => {
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

});
