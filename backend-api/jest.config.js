/**
 * Jest configuration, two projects:
 *   unit  — every *.spec.ts except *.int.spec.ts. No database, no network. Runs in the CI "backend" job.
 *   int   — *.int.spec.ts. Talks to the STAGING database only: each file starts with `import './support/staging-env'`,
 *           which runs the staging guard (refuses anything but the allow-listed staging project, never production).
 * Scripts: npm run test:ci (unit), npm run test:int (integration).
 */
const base = {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', diagnostics: { warnOnly: false } }] },
};

module.exports = {
  testTimeout: 30000,
  projects: [
    {
      ...base,
      displayName: 'unit',
      // @nestjs/schedule is ESM-only. Specs that exercise a cron class mock it themselves (jest.mock); any other spec that merely loads a module with a cron (canonical switch, slice 5.6b) gets the no-op stand-in.
      moduleNameMapper: { '^@nestjs/schedule$': '<rootDir>/test/support/schedule-stub.js' },
      roots: ['<rootDir>/test', '<rootDir>/src'],
      testRegex: '(?<!\\.int)\\.spec\\.ts$',
      testPathIgnorePatterns: ['/node_modules/', '/dist/'],
    },
    {
      ...base,
      displayName: 'int',
      // @nestjs/schedule is ESM-only and Jest cannot parse it; the integration project uses a no-op stand-in (test/support/schedule-stub.js). The unit project mocks it per spec.
      moduleNameMapper: { '^@nestjs/schedule$': '<rootDir>/test/support/schedule-stub.js' },
      roots: ['<rootDir>/test'],
      testRegex: '\\.int\\.spec\\.ts$',
      testPathIgnorePatterns: ['/node_modules/', '/dist/'],
    },
  ],
};
