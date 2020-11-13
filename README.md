[![CircleCI](https://img.shields.io/circleci/build/github/dzaman/erector)](https://circleci.com/gh/dzaman/erector) [![codecov](https://img.shields.io/codecov/c/github/dzaman/erector)](https://codecov.io/gh/dzaman/erector)

# Erector

`knex` is the most popular query building library for Node, sharing a name with [Knex](https://sgwmscdnimages.azureedge.net/84/1-28-2020/58340082863044Joer.JPG), the children's building set. `erector` is a bare-metal query builder for Node named after Knex's bare-metal cousin, the [Erector Set](https://sgwmscdnimages.azureedge.net/84/1-28-2020/58340082863044Joer.JPG).

Erector aims to allow developers to write modular, composable, conditional queries using template strings that safely escape literals and identifiers.

This is done by inspecting the query text surrounding template parameters to determine the correct escaping and formatting behavior for each parameter.

## Examples

### Escaping Literals

**Input**
```
email='the@email.com';
passwordhash = 'thehash';

erector`select * from "user" where email=${email} and password_hash=${passwordHash}`
```

**Output**
```
select * from "user" where email='the@email.com' and password_hash='thehash'
```

### Escaping Identifiers

**Input**
```
table='data_warehouse.events';

erector`select * from "${table}" where id=123`
```

**Output**
```
select * from "data_warehouse"."events" where id=123
```

### Setting values only if they're defined

**Input**
```
erector`update "preferences" ${setdefined({
  foo: 'abc',
  bar: identifier('column_ref'),
  baz: undefined,
})}`;
```

**Output**
```
update "preferences" set foo='abc', bar="column_ref"
```

### Inserting values from a list

**Input**
```
erector`insert into "user" (${labels()}) values (${values({
  foo: 'abc',
  bar: 123,
})})`;
```

**Output**
```
insert into "user" ("foo", "bar") values('abc', 123);
```

### Selecting a list of columns

**Input**
```
erector`select ${labels('foo', 'bar', 'baz')} from "user" limit 1;
```

***Output**
```
select "foo", "bar", "baz" from "user" limit 1;
```

### Checking for values in an array

**Input**
```
erector`update "foo" set something=true where "bar" in (${values('a', 'b', 'c')})`;
```

**Output**
```
update "foo" set something=true where "bar" in ('a', 'b', 'c');
```

### Conditional joins
**Input**
```
hasMessages = true;

erector`
  select * from "user" as u
  ${condition(hasMessages, 'join "message" as m on m.user_id = u.id')}
`;
```

**Output**
```
select * from "user" as u
join "message" as m on m.user_id = u.id
```

### And so on...

There are more helpers available like `cmp`, `cmp_subquery`, `or`, and `and` and more ways to interact with the utilities described above.

## Module & Class Overview

<img width="1083" alt="Screen Shot 2020-11-12 at 7 57 43 PM" src="https://user-images.githubusercontent.com/3486978/99027188-7ca0e600-2521-11eb-9ced-63be3e4b72e7.png">

### Erector

File: `lib/erector.ts`
Exports:
  - `raw` - Raw template factory for non-escaped values
  - `i`, `identifier` - Identifier template factory (value to be escaped as "the"."value")
  - `l`, `literal` - Literal template factory (value to be escaped as 'value')
  - `condition`, `if` - Evaluates a condition and returns the pass or fail value accordingly
  - `cmp_subquery` - Statement factory corresponding to "??? IN (???, ...)"
  - `cmp` - Statement factory corresponding to "??? *operator* ???"
  - `and` - Statement factory correspondng to "??? AND ???"
  - `or` - Statement factory corresponding to "??? OR ???"
  - `set` - Statement factory corresponding to a set condition (??=?, ...)
  - `setdefined` - Statement factory corresponding to a set condition that filters undefined values
  - `values` - ListValues factory
  - `labels` - ListLabels factory
  - **`erector`** - a namespace containing all of the above exports

## Summary

### The Good

- Minimal API that is sufficiently comprehensive for real-world applications
  - Flexible invocation patterns
  - Separation of responsibility for parsing and formatting
- 100% test coverage, with automated builds for [all high-volume Node versions](https://app.circleci.com/pipelines/github/dzaman/erector/145/workflows/f5afa7f8-9099-4587-8fff-4256ff625d47)
- Well typed (mostly)
  - I hadn't [gotten around to](https://github.com/dzaman/erector/projects/1) cleaning up all of the types and casts
- There's documentation on the decisions around the [release process](https://github.com/dzaman/erector/wiki/release-process) and some [typescript decisions](https://github.com/dzaman/erector/wiki/erector-module-definition). The intent is to document the _why_ behind decisions with signifcant impact or that required research.
- Dev tooling coverage for: *(see `package.json`)*
  - building 
  - testing & coverage
  - tsdoc doc generation & publishing

### The Bad

- There's not much code-level documentation that I didn't add *just now* (specifically for this branch)
  - Though there is [intent](https://github.com/dzaman/erector/wiki/documentation-plan) to get documentation ready before 1.0 (along with some other [prerequisites](https://github.com/dzaman/erector/wiki/milestone-plan))
  - The `jsdoc` comments are mainly there to test `tsdoc` generation at this point 🤦‍♂️
- The testing, while comprehensive, is focused mostly on unit tests and not more complex, illustrative applications. They're the kind of tests you write while actively developing, not tests written with the perspective of the completed library
  - I use `test.each` to iterate over test inputs without repeating test code, and in some cases I include labels that describe each case, and in other cases I omitted those. I found this style of writing tests to be harder to read than I liked and subsequently avoided it.
- I hadn't landed my [linting](https://github.com/dzaman/erector/pull/32) PR

### The ~~Ugly~~ Odd 

- I decided to remove `lodash` and make this a zero-dependency module. I depended on four functions that had to be added custom in `lib/util`. These functions are lifted from `lodash` directly and tested for compatibility with `lodash` explicitly. The [why](https://github.com/dzaman/erector/wiki/utility-functions) is actually covered in a wiki doc, but ultimately it wasn't an ROI focused decision -- I thought it would be fun.
- I wanted compatible escaping behavior with `knex` to enable migration which is why there's borrowed escaping code in `lib/escape` and there are tests verifying compatibilty with the `knex`
