/**
 * Jest Configuration
 *
 * Enterprise-grade test configuration with coverage requirements
 */

export default {
  // Test environment
  testEnvironment: 'node',

  // Root directory
  rootDir: '.',

  // Test path patterns
  testMatch: [
    '**/test/**/*.test.js',
    '**/__tests__/**/*.js'
  ],

  // Collect coverage from these files
  collectCoverageFrom: [
    'src/**/*.js',
    'routes/**/*.js',
    'minecraft_bridge_mineflayer.js',
    '!src/**/*.test.js',
    '!**/__tests__/**',
    '!**/node_modules/**'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    },
    './src/executors/**/*.js': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './src/services/**/*.js': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Coverage directory
  coverageDirectory: 'coverage',

  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'json',
    'lcov',
    'cobertura'
  ],

  // Module name mapper (for aliases)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@test/(.*)$': '<rootDir>/test/$1'
  },

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/test/setup.js'
  ],

  // Globals
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json'
    }
  },

  // Test timeout (30 seconds for integration tests)
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Max workers
  maxWorkers: '50%',

  // Bail on first failure (disable for full suite)
  bail: false,

  // Notify on completion
  notify: false,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks between tests
  restoreMocks: true,

  // Reset mocks between tests
  resetMocks: true,

  // Transform files
  transform: {
    '^.+\\.jsx?$': 'babel-jest'
  },

  // Module file extensions
  moduleFileExtensions: [
    'js',
    'json'
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ],

  // Watch ignore patterns
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ]
};
