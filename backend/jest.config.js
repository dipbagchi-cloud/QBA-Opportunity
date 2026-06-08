/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFiles: ['<rootDir>/src/__tests__/jest.setup-env.ts'],
  clearMocks: true,
  // supertest opens short-lived sockets; force a clean exit for CI.
  forceExit: true,
  // Test files live under src/__tests__ but are excluded from the production
  // `tsc` build (see tsconfig.json), so they never reach dist/.
  collectCoverageFrom: [
    'src/lib/permissions.ts',
    'src/lib/opportunity-access.ts',
    'src/lib/gom-calculator.ts',
    'src/lib/opportunity-probability.ts',
    'src/services/auth.service.ts',
  ],
};
