import { Prisma } from '@prisma/client';

/**
 * A client that can run `$executeRaw` — a PrismaService or the `tx` of an interactive `$transaction`.
 * (Structural, so tests can pass an in-memory fake.)
 */
export type LockDb = Pick<Prisma.TransactionClient, '$executeRaw'>;

/**
 * Transaction-scoped advisory lock: blocks until no other transaction holds `key`, then holds it until THIS
 * transaction commits or rolls back (Postgres releases it automatically). Call it as the first statement of a
 * `prisma.$transaction(async (tx) => { … })` callback, passing `tx`.
 *
 * WHY `$executeRaw` AND NOT `$queryRaw`: `pg_advisory_xact_lock()` returns `void`. Prisma cannot deserialise a
 * `void` result column, so `SELECT pg_advisory_xact_lock(…)` through `$queryRaw`/`$queryRawUnsafe` throws
 * "Failed to deserialize column of type 'void'" (live incident, 2026-10-07, Admin → Commerce → Deal builder).
 * `$executeRaw` reads no result set, so the lock is taken without the error. Never SELECT a void function
 * (pg_advisory_lock, pg_advisory_xact_lock, pg_advisory_unlock_all, pg_notify, pg_sleep) through a query-returning
 * raw call — `npm run verify:raw-sql` fails the build if anyone does.
 *
 * The key is a bound parameter (never string-concatenated); `hashtext` maps it to the lock's integer id, as before.
 */
export async function advisoryXactLock(db: LockDb, key: string): Promise<void> {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}
