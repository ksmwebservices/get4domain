/**
 * Jest configuration, two projects:
 *   unit  — every *.spec.ts except *.int.spec.ts. No database, no network. Runs in the CI "backend" job.
 *   web   — the vendor-site React files (get4domain_mvp/src/engine), rendered to HTML with react-dom/server. The frontend's own node_modules are not needed: React comes from this package, and the few
 *           Next.js / icon / API imports are stubs (test/web/stubs). Runs in the CI "backend" job with the unit project.
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
      rootDir: '.',
      testEnvironment: 'node',
      displayName: 'web',
      roots: ['<rootDir>/test/web'],
      testRegex: '\\.spec\\.tsx$',
      moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
      modulePaths: ['<rootDir>/node_modules'],   // the frontend files are outside this package: bare imports (react) resolve here
      transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/test/web/tsconfig.json', diagnostics: false }] },
      moduleNameMapper: {
        '^@/lib/api$': '<rootDir>/test/web/stubs/api.js', '^@/(.*)$': '<rootDir>/../get4domain_mvp/src/$1',
        '^lucide-react$': '<rootDir>/test/web/stubs/lucide-react.js', '^next/link$': '<rootDir>/test/web/stubs/next-link.js', '^next/(navigation|image|dynamic|headers)$': '<rootDir>/test/web/stubs/next-misc.js',
      },
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
