#!/usr/bin/env node
const _ = require('lodash');
const child_process = require('child_process');
const fs = require('fs');

const ORIGINAL_SIZE = 500;

const lodash_calls = Object.keys(
  child_process
  .execFileSync('ack', ['-oh', '_\\.[A-Za-z]+', 'lib', 'tests'])
  .toString('utf8')
  .split('\n')
  .filter((call) => !!call)
  .map((call) => call.substring(2))
  .reduce((acc, call) => {
    acc[call] = true;
    return acc;
  }, {})
);

lodash_calls.sort();
console.log('Calls:');
lodash_calls.forEach((call) => console.log(` - ${call}`));

try {
  child_process.execFileSync('node_modules/.bin/lodash', ['-d', '-o', 'vendor/lodash.custom.js', `include=${lodash_calls.join(',')}`]);
  const stat = fs.statSync('vendor/lodash.custom.js');
  const size = Math.ceil(stat.size/1024);
  console.log(`Size in KB: ${size} (down ${ORIGINAL_SIZE - size}, was ${ORIGINAL_SIZE}KB)`);
} catch (e) {
  console.error('Error building lodash vendor file');
  process.exit(e.status);
}

