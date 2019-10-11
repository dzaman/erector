const base_config = require('./jest.config.js');

module.exports = {
  ...base_config,
  modulePaths: ['<rootDir>/build'],
  transform: undefined,
};
