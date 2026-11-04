/* Drift allowlist for `npm run db:staging:drift`. STAGING ONLY, pure functions (no database, no I/O): tested in test/drift-allowlist.spec.ts.
 *
 * Prisma cannot express two things the slice 5.7 migration creates on purpose, so `prisma migrate diff` always reports them:
 *   1. the pg_trgm GIN index  "g4d_directory_businesses_name_trgm_idx" on g4d_directory_businesses(name)
 *      (an operator-class index; created in a guarded block that is skipped when the extension is unavailable);
 *   2. the generated tsvector column "searchVector" on g4d_directory_businesses
 *      (GENERATED ALWAYS AS ... STORED; the schema declares it Unsupported("tsvector"), so Prisma cannot see the expression).
 * Exactly these two items are allowed. Anything else in the diff still fails the gate. Documented in docs/v3/B2_LOG.md.
 */
const TABLE = 'g4d_directory_businesses';
const q = (s) => `"${s}"`;

/** Each rule matches ONE whole normalised statement (no trailing semicolon). Keep this list at two intents; do not widen it. */
const ALLOWED = [
  new RegExp(`^DROP INDEX (?:"public"\\.)?${q(`${TABLE}_name_trgm_idx`)}$`, 'i'),
  new RegExp(`^ALTER TABLE (?:"public"\\.)?${q(TABLE)} (?:ALTER COLUMN ${q('searchVector')} (?:DROP DEFAULT|DROP EXPRESSION|SET DATA TYPE tsvector|TYPE tsvector|DROP NOT NULL)|DROP COLUMN ${q('searchVector')})$`, 'i'),
];

/** Splits a `prisma migrate diff --script` output into normalised statements (comments removed, whitespace collapsed). */
function statements(script) {
  const noComments = String(script || '').split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
  return noComments.split(/;\s*(?:\n|$)/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/** Returns { allowed: string[], unexpected: string[] }. The gate passes only when `unexpected` is empty. */
function classifyDrift(script) {
  const allowed = []; const unexpected = [];
  for (const s of statements(script)) (ALLOWED.some((re) => re.test(s)) ? allowed : unexpected).push(s);
  return { allowed, unexpected };
}

module.exports = { classifyDrift, statements, ALLOWED };
