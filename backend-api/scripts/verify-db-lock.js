#!/usr/bin/env node
'use strict';
/**
 * Real-database check of the advisory-lock helper (src/common/db-lock.ts). SIDE-EFFECT FREE: it touches no table —
 * it only takes transaction-scoped advisory locks, which Postgres releases at commit. KSM runs it on the VM after deploy:
 *
 *   cd backend-api && npx nest build && node scripts/verify-db-lock.js        (npm run verify:db-lock)
 *
 * Uses the app's DATABASE_URL (read from .env.local when it is not already in the environment) and a plain PrismaClient.
 *   1. (informational) the OLD form — SELECT pg_advisory_xact_lock through $queryRawUnsafe — is expected to FAIL with
 *      Prisma's "Failed to deserialize column of type 'void'"; this shows the environment reproduces the bug.
 *   2. the helper inside $transaction returns OK.
 *   3. two concurrent transactions on the SAME key: the second must WAIT until the first commits;
 *      a transaction on a DIFFERENT key must not wait.
 * Exit code 0 only if 2 and 3 pass.
 */
const fs = require('fs');
const path = require('path');

if (!process.env.DATABASE_URL) {
  const file = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(file)) {
    for (const l of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set (and backend-api/.env.local was not found).'); process.exit(2); }

const { PrismaClient } = require('@prisma/client');
const { advisoryXactLock } = require(path.join(__dirname, '..', 'dist', 'src', 'common', 'db-lock'));

const HOLD_MS = 1500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  OK  ' : '  FAIL'} ${name}${detail ? `  (${detail})` : ''}`); if (!cond) failed += 1; };

(async () => {
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host; } catch { return 'unknown'; } })();
  console.log(`Advisory-lock check — database host: ${host} (no tables are read or written)\n`);
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  const run = (fn) => prisma.$transaction(fn, { timeout: 20000, maxWait: 15000 });
  const key = `verify-db-lock:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  try {
    // 1. The old form (informational).
    try {
      await run((tx) => tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `${key}:old`));
      console.log('  note  the OLD form did not throw on this Prisma/Postgres combination (the helper is still the safe choice)');
    } catch (e) {
      const m = String(e.message);
      console.log(`  note  OLD form fails as expected: ${/'void'/.test(m) ? "Failed to deserialize column of type 'void'" : m.split('\n').filter(Boolean).pop().slice(0, 120)}`);
    }

    // 2. The helper inside a transaction.
    let result = null;
    try { result = await run(async (tx) => { await advisoryXactLock(tx, `${key}:basic`); return 'OK'; }); } catch (e) { console.log(`        ${String(e.message).split('\n').filter(Boolean).pop()}`); }
    ok('helper takes a transaction-scoped lock without error', result === 'OK', `result=${result}`);

    // 3. Concurrency: same key waits, different key does not.
    const t0 = Date.now();
    let aLockedAt = 0; let aCommittedAt = 0; let bLockedAt = 0; let cLockedAt = 0;
    let aHasLock; const aReady = new Promise((r) => { aHasLock = r; });
    const A = run(async (tx) => { await advisoryXactLock(tx, `${key}:shared`); aLockedAt = Date.now() - t0; aHasLock(); await sleep(HOLD_MS); aCommittedAt = Date.now() - t0; });
    await aReady;
    const B = run(async (tx) => { await advisoryXactLock(tx, `${key}:shared`); bLockedAt = Date.now() - t0; });
    const C = run(async (tx) => { await advisoryXactLock(tx, `${key}:other`); cLockedAt = Date.now() - t0; });
    await Promise.all([A, B, C]);
    console.log(`        A locked at ${aLockedAt} ms, committed at ${aCommittedAt} ms · B (same key) locked at ${bLockedAt} ms · C (other key) locked at ${cLockedAt} ms`);
    ok('the second transaction on the same key WAITED for the first to commit', bLockedAt >= aCommittedAt - 50, `B ${bLockedAt} ms ≥ A commit ${aCommittedAt} ms`);
    ok('a transaction on a different key did NOT wait', cLockedAt < aCommittedAt - 200, `C ${cLockedAt} ms < A commit ${aCommittedAt} ms`);
    // Locks are released at commit: a fresh transaction on the same key proceeds immediately.
    const t1 = Date.now();
    await run((tx) => advisoryXactLock(tx, `${key}:shared`));
    ok('the lock was released at commit (a later transaction on the same key is instant)', Date.now() - t1 < 1000, `${Date.now() - t1} ms`);
  } finally {
    await prisma.$disconnect();
  }
  console.log(failed ? `\n${failed} check(s) FAILED` : '\nALL OK — advisory locks work against this database.');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERROR:', e && e.message ? e.message : e); process.exit(1); });
