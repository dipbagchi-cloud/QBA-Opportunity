/**
 * Jest configuration for Q-CRM Mobile.
 * This file takes precedence over the "jest" key in package.json.
 */

module.exports = {
  preset: 'react-native',

  // ── File extensions ─────────────────────────────────────────────────────
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // ── Setup files ─────────────────────────────────────────────────────────
  // jest.setup.js already imports react-native-gesture-handler/jestSetup
  setupFiles: [
    './jest.setup.js',
  ],

  setupFilesAfterEnv: [
    '@testing-library/jest-native/extend-expect',
  ],

  // ── Path aliases (match tsconfig.json paths) ─────────────────────────────
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@screens/(.*)$': '<rootDir>/src/screens/$1',
    '^@navigation/(.*)$': '<rootDir>/src/navigation/$1',
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@theme/(.*)$': '<rootDir>/src/theme/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@contexts/(.*)$': '<rootDir>/src/contexts/$1',
  },

  // ── Transform ────────────────────────────────────────────────────────────
  // Exclude node_modules from transformation EXCEPT these packages which
  // ship un-transpiled ESM or native modules.
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      'react-native' +
      '|@react-native' +
      '|@react-navigation' +
      '|react-native-paper' +
      '|react-native-vector-icons' +
      '|victory-native' +
      '|react-native-svg' +
      '|react-native-reanimated' +
      '|react-native-screens' +
      '|react-native-safe-area-context' +
      '|react-native-gesture-handler' +
      '|@react-native-async-storage' +
      '|@react-native-masked-view' +
      '|@react-native-community' +
      '|react-native-animatable' +
      '|zustand' +
      ')/)',
  ],

  // ── Test patterns ────────────────────────────────────────────────────────
  testMatch: [
    '**/__tests__/**/*.{test,spec}.{ts,tsx}',
    '**/*.{spec,test}.{ts,tsx}',
  ],

  // Exclude helper/setup directories from test discovery
  testPathIgnorePatterns: [
    '/node_modules/',
    '/android/',
    '/ios/',
    '/__tests__/setup/',
  ],

  // ── Coverage ─────────────────────────────────────────────────────────────
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/types/**',
    '!src/navigation/types.ts',
  ],

  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
  },

  // ── Misc ─────────────────────────────────────────────────────────────────
  testEnvironment: 'node',
  verbose: true,
  bail: false,
};
