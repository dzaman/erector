const {
  escape,
// should this be exported from the main module?
// } = require('../lib/erector');
} = require('../lib/escape');

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

    test.skip('named literals are supported', () => {
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

    test.skip('named identifiers are supported', () => {
      expect(escape('the quick brown :animal:', { animal: 'fox' })).toBe('the quick brown "fox"');
    });
  });
});
