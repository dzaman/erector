const {
  Identifier,
  Literal,
  Raw,

  ListValues,
  ListLabels,

  Statement,
} = require('/lib/query-parts');

const _ = require('lodash');

describe('query-parts', () => {
  describe('list', () => {
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
  });
});
