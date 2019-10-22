const expect = require('expect');
const _ = require('lodash');

const util = require('/lib/util');

// convert 1, 2, 3 to an arguments array of 1, 2, 3
const ARGS = (() => arguments).apply(undefined, [1, 2, 3]);

describe('util', () => {
  describe('isString', () => {
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
      expect(util.isString(input)).toBe(expected);
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

  // this is imported directly and probably doesn't need a test
  describe.skip('isTypedArray', () => {
    test.each([
      [new Int8Array(), true],
      [new Uint8Array(), true],
      [new Uint8ClampedArray(), true],
      [new Int16Array(), true],
      [new Uint16Array(), true],
      [new Int32Array(), true],
      [new Uint32Array(), true],
      [new Float32Array(), true],
      [new Float64Array(), true],
      // [new BigInt64Array(), true],
      // [new BigUint64Array(), true],
      // test inputs are from from Lodash
      // https://github.com/lodash/lodash/blob/master/test/isTypedArray.js
      [ARGS, false],
      [[1, 2, 3], false],
      [true, false],
      [new Date, false],
      [new Error, false],
      [() => null, false],
      [{ 'a': 1 }, false],
      [1, false],
      [/x/, false],
      ['a', false],
      [Symbol('a'), false],
    ])('format with override %p -> %p', (input, expected) => {
      expect(util.isTypedArray(input)).toBe(expected);
    });

  });

  describe('isObject', () => {
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
      expect(util.isObject(input)).toBe(expected);
    });
  });

  describe('isPlainObject', () => {
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
    ])('isPlainObject(%p) -> %p', (input, expected) => {
      expect(_.isPlainObject(input)).toBe(expected);
      expect(util.isPlainObject(input)).toBe(expected);
    });

  });
});

