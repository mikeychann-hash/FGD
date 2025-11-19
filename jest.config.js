export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', 'routes/**/*.js', 'middleware/**/*.js'],
  coverageDirectory: 'coverage'
};
