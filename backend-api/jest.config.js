/** Jest configuration. Tests live in backend-api/test (integration/unit) and may also sit beside code as *.spec.ts. */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  roots: ['<rootDir>/test', '<rootDir>/src'],
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', diagnostics: { warnOnly: false } }] },
  // The generated Prisma client and the compiled output are never test inputs.
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  testTimeout: 30000,
  // Tests that touch a database load test/support/staging-only.ts first, which refuses anything but the allow-listed staging project.
};
