const nextJest = require('next/jest');

// next/jest wires up SWC transforms, tsconfig path aliases (@/...), CSS module
// mocks and next-env so tests run against the same config as `next build`.
const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  clearMocks: true,
  collectCoverageFrom: [
    'lib/access-control.ts',
    'lib/gom-calculator.ts',
    'lib/utils.ts',
  ],
};

module.exports = createJestConfig(customJestConfig);
