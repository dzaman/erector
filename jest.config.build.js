const base_config = require('./jest.config.js');

Object.assign(module.exports, base_config, {
  modulePaths: ['<rootDir>/build'],
  transform: undefined,
});
