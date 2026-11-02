/* Staging database runner. STAGING ONLY — guarded. Usage: node scripts/staging/run.js <command>
 *   baseline-sql    generate prisma/staging/baseline.sql from schema.prisma (offline, no database)
 *   apply-baseline  refuse unless staging is empty, then apply baseline.sql to STAGING
 *   resolve-all     mark every local migration folder as applied on STAGING (records history only)
 *   rls             run prisma/sql/enable_rls_public.sql on STAGING
 *   status          prisma migrate status against STAGING
 *   rls-off         count public tables with RLS off on STAGING (must be 0)
 *   all             apply-baseline, resolve-all, rls, status, rls-off in order
 * Output is masked: connection strings, hosts, usernames and passwords never appear.
 * Nothing here can reach production: the guard refuses any project not on the staging allow-list.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadStagingEnv } = require('./guard');

const BACKEND = path.resolve(__dirname, '../..');
const PRISMA = path.join(BACKEND, 'node_modules/prisma/build/index.js');
const BASELINE = path.join(BACKEND, 'prisma/staging/baseline.sql');
const cmd = process.argv[2];

function prisma(args, env, mask) {
  const r = spawnSync(process.execPath, [PRISMA, ...args], {
    cwd: BACKEND, encoding: 'utf8', env: { ...process.env, DATABASE_URL: env.DATABASE_URL, DIRECT_URL: env.DIRECT_URL },
  });
  const text = mask(`${r.stdout || ''}${r.stderr || ''}`).trim();
  if (text) console.log(text);
  return r;
}

async function sql(env, statement) {
  if (!/^\s*select\b/i.test(statement) || statement.includes(';')) throw new Error('only single SELECT statements allowed here');
  const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));
  const client = new PrismaClient({ datasourceUrl: env.DATABASE_URL, log: [] });
  try {
    const rows = await client.$queryRawUnsafe(statement);
    return JSON.parse(JSON.stringify(rows, (_, v) => (typeof v === 'bigint' ? Number(v) : v)));
  } catch (e) {
    throw new Error(env.mask(e.message).split('\n').slice(-2).join(' | '));
  } finally { await client.$disconnect().catch(() => {}); }
}

const TABLES = `SELECT count(*) AS n FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relkind IN ('r','p')`;
const RLS_OFF = `SELECT c.relname AS tbl FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity ORDER BY 1`;

async function main() {
  if (cmd === 'baseline-sql') {
    fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
    const r = spawnSync(process.execPath, [PRISMA, 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], { cwd: BACKEND, encoding: 'utf8' });
    if (r.status !== 0) { console.error(r.stderr.slice(0, 500)); process.exit(1); }
    fs.writeFileSync(BASELINE, r.stdout);
    console.log(`baseline written: ${r.stdout.split('\n').length} lines, ${(r.stdout.match(/CREATE TABLE/g) || []).length} CREATE TABLE, ${(r.stdout.match(/CREATE TYPE/g) || []).length} CREATE TYPE`);
    return;
  }
  const env = loadStagingEnv();      // exits if this is not the allow-listed staging project
  const steps = cmd === 'all' ? ['extensions', 'apply-baseline', 'resolve-all', 'rls', 'status', 'rls-off'] : [cmd];
  for (const step of steps) {
    console.log(`\n== ${step} (staging) ==`);
    if (step === 'extensions') {
      // Production has: pg_stat_statements, pgcrypto, plpgsql, supabase_vault, uuid-ossp.
      // Supabase ships the others by default; only the two below are ever created, and only if missing.
      const WANTED = ['pgcrypto', 'uuid-ossp'];
      const have = (await sql(env, `SELECT extname FROM pg_catalog.pg_extension ORDER BY 1`)).map((r) => r.extname);
      console.log(`present on staging: ${have.join(', ')}`);
      const missing = WANTED.filter((w) => !have.includes(w));
      if (!missing.length) { console.log('nothing to create: pgcrypto and uuid-ossp already present'); continue; }
      const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));
      const client = new PrismaClient({ datasourceUrl: env.DATABASE_URL, log: [] });
      try {
        for (const name of missing) {
          await client.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "${name}" WITH SCHEMA extensions`); // name is from the fixed list above
          console.log(`created: ${name} (schema extensions)`);
        }
      } catch (e) { console.error('ERROR:', env.mask(e.message).split('\n').slice(-2).join(' | ')); process.exit(8); }
      finally { await client.$disconnect().catch(() => {}); }
      const after = (await sql(env, `SELECT extname FROM pg_catalog.pg_extension ORDER BY 1`)).map((r) => r.extname);
      console.log(`now on staging: ${after.join(', ')}`);
    } else if (step === 'apply-baseline') {
      const [{ n }] = await sql(env, TABLES);
      if (n !== 0) { console.error(`REFUSED: staging already has ${n} public tables (expected 0). Not applying the baseline.`); process.exit(4); }
      const r = prisma(['db', 'execute', '--file', 'prisma/staging/baseline.sql', '--schema', 'prisma/schema.prisma'], env, env.mask);
      if (r.status !== 0) process.exit(5);
      const [{ n: after }] = await sql(env, TABLES);
      console.log(`public tables now: ${after}`);
    } else if (step === 'resolve-all') {
      const dirs = fs.readdirSync(path.join(BACKEND, 'prisma/migrations'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
      let ok = 0;
      for (const d of dirs) {
        const r = spawnSync(process.execPath, [PRISMA, 'migrate', 'resolve', '--applied', d], { cwd: BACKEND, encoding: 'utf8', env: { ...process.env, DATABASE_URL: env.DATABASE_URL, DIRECT_URL: env.DIRECT_URL } });
        if (r.status === 0) ok += 1; else { console.error(`FAILED ${d}: ${env.mask(`${r.stdout}${r.stderr}`).trim().split('\n').slice(-2).join(' | ')}`); process.exit(6); }
      }
      console.log(`marked applied: ${ok} of ${dirs.length}`);
    } else if (step === 'rls') {
      const r = prisma(['db', 'execute', '--file', 'prisma/sql/enable_rls_public.sql', '--schema', 'prisma/schema.prisma'], env, env.mask);
      if (r.status !== 0) process.exit(7);
    } else if (step === 'migrate-deploy') {
      // Applies pending prisma/migrations folders to STAGING only (the guard above refuses any other database).
      const r = prisma(['migrate', 'deploy'], env, env.mask);
      if (r.status !== 0) { console.error('migrate deploy failed on staging.'); process.exit(11); }
    } else if (step === 'drift') {
      // Exit 0 = the live staging structure equals prisma/schema.prisma; exit 2 = they differ (the diff is printed, masked).
      const r = prisma(['migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma', '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code'], env, env.mask);
      if (r.status !== 0) { console.error('GATE FAILED: staging structure differs from schema.prisma.'); process.exit(12); }
      console.log('no drift: staging structure equals schema.prisma');
    } else if (step === 'status') {
      // `prisma migrate status` exits non-zero when migrations are pending, failed or missing: propagate it (CI gate).
      const r = prisma(['migrate', 'status'], env, env.mask);
      if (r.status !== 0) { console.error('GATE FAILED: staging is not up to date with prisma/migrations.'); process.exit(9); }
    } else if (step === 'rls-off') {
      const rows = await sql(env, RLS_OFF);
      console.log(`tables with RLS OFF: ${rows.length}`);
      rows.forEach((x) => console.log('  -', x.tbl));
      if (rows.length > 0) { console.error('GATE FAILED: tables without row-level security on staging.'); process.exit(10); }
    } else { console.error('unknown command'); process.exit(2); }
  }
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
