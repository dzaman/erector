
module.exports = {
  // can pass this in via the command line or invoke a separate config for CI/pre-commit
  // but the current time difference is very minor (10s of ms max)
  // npm test -- --collect-coverage
  // but it screws up line numbers
  // collectCoverage: true,
  verbose: true,
  testMatch: ['**/tests/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[tj]s?(x)'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  moduleFileExtensions: [ 'js', 'json', 'jsx', 'node', 'ts', 'tsx' ],
  // testEnvironment: './test-environment.js',
  // globalSetup: './global-setup.js',
};

