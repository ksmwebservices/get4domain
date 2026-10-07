// What REAL Prisma does with raw SQL, for the in-memory fakes used by the verify suites.
//
// Incident 2026-10-07: `SELECT pg_advisory_xact_lock(...)` through $queryRaw/$queryRawUnsafe throws in real Prisma
// ("Failed to deserialize column of type 'void'"), but the fakes accepted it, so every test passed while the live
// Deal builder failed. The fakes now share this check. Lock functions must go through $executeRaw (no result set).
const VOID_FN = /\bpg_(?:advisory_(?:xact_)?lock(?:_shared)?|advisory_unlock_all|notify|sleep(?:_for|_until)?)\s*\(/i;
const LOCK_FN = /\bpg_advisory_(?:xact_)?lock(?:_shared)?\s*\(/i;
const TRY_LOCK_FN = /\bpg_try_advisory_xact_lock\s*\(/i;

/** Throws exactly like Prisma when a query-returning raw call selects a void-returning function. */
function assertQueryRawOk(method, sql) {
  if (!VOID_FN.test(String(sql))) return;
  const e = new Error(`\nInvalid \`prisma.${method}()\` invocation:\n\n\nRaw query failed. Code: \`N/A\`. Message: \`Failed to deserialize column of type 'void'. If you're using $queryRaw and this column is intentionally unsupported, you can cast the column to a supported type (for example ::text).\``);
  e.name = 'PrismaClientKnownRequestError';
  e.code = 'P2010';
  throw e;
}

/** Text of a tagged-template call: strings joined with $1, $2… */
const templateSql = (strings) => (Array.isArray(strings) ? strings.reduce((a, s, i) => a + (i ? `$${i}` : '') + s, '') : String(strings));

module.exports = { VOID_FN, LOCK_FN, TRY_LOCK_FN, assertQueryRawOk, templateSql };
