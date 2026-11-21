// Drift gate allowlist (scripts/staging/drift-allowlist.js): exactly the two intentional differences pass; anything else fails.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { classifyDrift, statements } = require('../scripts/staging/drift-allowlist.js') as {
  classifyDrift: (s: string) => { allowed: string[]; unexpected: string[] };
  statements: (s: string) => string[];
};

const TRGM = '-- DropIndex\nDROP INDEX "g4d_directory_businesses_name_trgm_idx";\n';
const VECTOR = '-- AlterTable\nALTER TABLE "g4d_directory_businesses" ALTER COLUMN "searchVector" DROP DEFAULT;\n';

describe('drift allowlist', () => {
  it('an empty diff has nothing allowed and nothing unexpected', () => {
    expect(classifyDrift('')).toEqual({ allowed: [], unexpected: [] });
    expect(classifyDrift('-- only a comment\n')).toEqual({ allowed: [], unexpected: [] });
  });

  it('the trigram index and the generated column pass, together or alone', () => {
    expect(classifyDrift(TRGM).unexpected).toEqual([]);
    expect(classifyDrift(VECTOR).unexpected).toEqual([]);
    const both = classifyDrift(`${TRGM}\n${VECTOR}`);
    expect(both.unexpected).toEqual([]); expect(both.allowed).toHaveLength(2);
  });

  it('any other statement fails, even next to an allowed one', () => {
    const extra = classifyDrift(`${TRGM}\nDROP INDEX "g4d_domains_something_idx";\n`);
    expect(extra.allowed).toHaveLength(1); expect(extra.unexpected).toEqual(['DROP INDEX "g4d_domains_something_idx"']);
  });

  it('near misses do not pass: another table, another column, another index, a dropped table', () => {
    for (const s of [
      'DROP INDEX "g4d_directory_locations_name_trgm_idx";',
      'ALTER TABLE "g4d_directory_locations" ALTER COLUMN "searchVector" DROP DEFAULT;',
      'ALTER TABLE "g4d_directory_businesses" DROP COLUMN "name";',
      'ALTER TABLE "g4d_directory_businesses" ADD COLUMN "x" TEXT;',
      'DROP TABLE "g4d_directory_businesses";',
      'DROP INDEX "g4d_directory_businesses_searchVector_idx";',
    ]) expect(classifyDrift(s).unexpected).toHaveLength(1);
  });

  it('splits and normalises statements (comments, line breaks, spacing)', () => {
    expect(statements('-- c\nDROP   INDEX\n "a";\n\n-- d\nDROP INDEX "b";\n')).toEqual(['DROP INDEX "a"', 'DROP INDEX "b"']);
  });
});
