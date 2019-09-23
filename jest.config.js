
module.exports = {
  // pass this in via the command line if possible or invoke a separate config for CI/pre-commit
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

