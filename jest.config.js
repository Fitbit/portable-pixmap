'use strict';

module.exports = {
  transform: {
    '^(?!.*\\.(d\\.ts)$).+\\.(js|ts)$': 'ts-jest',
  },
  transformIgnorePatterns: ['[/\\\\]node_modules[/\\\\].+\\.(js|mjs)$'],
  moduleFileExtensions: ['ts', 'js'],
  testEnvironment: 'node',
  testRegex: 'src/.*\\.test\\.ts$',
  coverageDirectory: '<rootDir>/coverage',
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts', '!**/*.d.ts'],
};
