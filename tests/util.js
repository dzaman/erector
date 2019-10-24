const expect = require('expect');
const _ = require('lodash');

const util = require('/lib/util');

// convert 1, 2, 3 to an arguments array of 1, 2, 3
const ARGS = (() => arguments).apply(undefined, [1, 2, 3]);

describe('util', () => {
  describe('is_string', () => {
    test.each([
      // test inputs are from from Lodash
      // https://github.com/lodash/lodash/blob/master/test/isString.test.js
      ['a', true],
      [Object('a'), true],
      [ARGS, false],
      [[1, 2, 3], false],
      [true, false],
      [new Date, false],
      [new Error, false],
      [() => null, false],
      [{ '0': 1, 'length': 1 }, false],
      [1, false],
      [/x/, false],
      [Symbol('a'), false],
    ])('format with override %p -> %p', (input, expected) => {
      expect(_.isString(input)).toBe(expected);
      expect(util.is_string(input)).toBe(expected);
    });
  });

  describe('sort', () => {
    test('sort returns the sorted array and sorts the array in place', () => {
      const expected = [5, 2, 4, 3, 1];
      const actual = _.clone(expected);
      expected.sort();
      // expected is not tied to actual
      expect(actual).not.toEqual(expected);
      // sorted value is returned
      expect(util.sort(actual)).toEqual(expected);
      // input was sorted in place
      expect(actual).toEqual(expected);
    });
  });

  describe('is_object', () => {
    test.each([
      [, false],
      [null, false],
      [undefined, false],
      [true, false],
      [false, false],
      [0, false],
      [1, false],
      [NaN, false],
      ['', false],
      ['a', false],
      [Symbol('a'), false],
      // test inputs are from from Lodash
      // https://github.com/lodash/lodash/blob/master/test/isObject.test.js
      [ARGS, true],
      [[1, 2, 3], true],
      [Object(false), true],
      [new Date, true],
      [new Error, true],
      [() => null, true],
      [{ 'a': 1 }, true],
      [Object(0), true],
      [/x/, true],
      [Object('a'), true],
    ])('format with override %p -> %p', (input, expected) => {
      expect(_.isObject(input)).toBe(expected);
      expect(util.is_object(input)).toBe(expected);
    });
  });

  describe('is_plain_object', () => {
    function SimpleConstructor() {
      this.a = 1;
    }
    const object_null_prototype = Object.create(null);
    object_null_prototype.constructor = Object.prototype.constructor;

    const object_writable_string_tag = {};
    object_writable_string_tag[Symbol.toStringTag] = 'X';

    const object_read_only_string_tag = {};
    Object.defineProperty(object_read_only_string_tag, Symbol.toStringTag, {
      configurable: true,
      enumerable: false,
      writable: false,
      value: 'X',
    });

    const object_tbd_proto = {};
    object_tbd_proto[Symbol.toStringTag] = undefined;
    const object_tbd = Object.create(object_tbd_proto);

    beforeAll(() => {
      // expect(object_tbd).not.toHaveProperty(Symbol.toStringTag);
      // expect(Symbol.toStringTag in object_tbd).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(object_tbd, Symbol.toStringTag)).toBe(false);
    });

    test.each([
      [{}, true],
      [{ 'a': 1 }, true],
      [{ 'constructor': SimpleConstructor }, true],
      [[1, 2, 3], false],
      [new SimpleConstructor(1), false],

      // should return `true` for objects with a `[[prototype]]` of `null`
      [Object.create(null), true],
      [Object.create(object_null_prototype), true],

      // should return `true` for objects with a `valueOf` property
      [{ 'valueOf': 0 }, true],

      // should return `true` for objects with a writable `Symbol.toStringTag` property
      [object_writable_string_tag, true],
      [{ [Symbol.toStringTag]: 'X' }, true],

      //  should return `false` for objects with a custom `[[Prototype]]`
      [Object.create({ a: 1 }), false],

      // should return `false` for non-Object objects
      [ARGS, false],
      [Error, false],
      [Math, false],

      // should return `false` for non-objects
      [, false],
      [null, false],
      [undefined, false],
      [true, false],
      [false, false],
      [0, false],
      [1, false],
      [NaN, false],
      ['', false],
      [true, false],
      ['a', false],
      [Symbol('a'), false],

      // object with read-only toStringTag
      [object_read_only_string_tag, false],

      // should not mutate `value`??
      [object_tbd, false],
    ])('is_plain_object(%p) -> %p', (input, expected) => {
      expect(_.isPlainObject(input)).toBe(expected);
      expect(util.is_plain_object(input)).toBe(expected);
    });

  });

  describe('get_undefined_indices', () => {
    test('returns undefined elements in an array', () => {
      expect(util.get_undefined_indices({ a: 1, b: undefined })).toEqual(['b']);
    });

    test('returns undefined elements in a hash', () => {
      expect(util.get_undefined_indices([1, undefined, 2, undefined])).toEqual([1, 3]);
    });

    test('returns 0 if param is not an array or hash', () => {
      expect(util.get_undefined_indices(123)).toEqual([0]);
    });
  });

  describe('contains_undefined', () => {
    test('returns true if undefined', () => {
      expect(util.contains_undefined(undefined)).toBe(true);
    });

    test('returns true if undefined exists in an array', () => {
      expect(util.contains_undefined([undefined])).toBe(true);
      expect(util.contains_undefined([0, undefined, 1])).toBe(true);
    });

    test('returns true if undefined exists in an object', () => {
      expect(util.contains_undefined({ a: undefined })).toBe(true);
      expect(util.contains_undefined({ a: undefined, b: true })).toBe(true);
    });

    test('returns true if undefined exists in sub-structures', () => {
      expect(util.contains_undefined({ a: [undefined] })).toBe(true);
      expect(util.contains_undefined([{ a: undefined }])).toBe(true);
    });
  });
});

