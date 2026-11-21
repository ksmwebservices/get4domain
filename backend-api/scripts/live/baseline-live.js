#!/usr/bin/env node
'use strict';
/**
 * STEP B of the live baseline (job M2): put the schema on an EMPTY live database and mark every migration as applied.
 *
 *   node scripts/live/baseline-live.js
 *
 * Needs: step A's two files in BASELINE_DIR (default backend-api/live-baseline), psql (same major version as the database), `npm ci` and `npm run build`, and DATABASE_URL and DIRECT_URL of the NEW live
 * database in the environment (export .env.live first). In this order, stopping at the first failure:
 *   1. the same refusals as migrate-live: a staging, test or local database, a placeholder, a missing connection;
 *   2. the schema file is checked (schema only, no data, no roles) and matches step A's manifest; the migration folders are listed oldest first;
 *   3. the database must be EMPTY (no public table, no migration history): otherwise it stops before changing anything;
 *   4. LIVE is typed at the prompt;
 *   5. the missing extensions (pgcrypto, uuid-ossp, pg_trgm, in the schema "extensions") are created, then the schema is applied in ONE transaction;
 *   6. the table count must equal the manifest; every migration folder is marked applied, in order (prisma migrate resolve --applied);
 *   7. the row level security check and the drift check run.
 * Prints counts only, never a connection string, a table name or the schema.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ask } = require('./prompt');
const { liveSeedEnv, applyConfirmed } = require('./live-env-lib');
const { pgEnvFromUrl, maskerFor } = require('./backup-lib');
const { runBaseline, EXTENSION_SCHEMA } = require('./baseline-lib');
const { classifyDrift } = require('../staging/drift-allowlist');

const BACKEND = path.resolve(__dirname, '..', '..');
const PRISMA = path.join(BACKEND, 'node_modules', 'prisma', 'build', 'index.js');
const fail = (msg, code) => { console.error(`BASELINE REFUSED: ${msg}`); process.exitCode = code; };

(async () => {
  if (process.argv.length > 2) return fail('this script takes no arguments.', 2);
  const { checkDatabaseUrls } = require(path.join(BACKEND, 'dist', 'src', 'common', 'startup-check'));
  const live = liveSeedEnv(process.env, checkDatabaseUrls);
  if (!live.ok) return fail(live.problems.join('; ') + '.', 3);
  const dir = process.env.BASELINE_DIR ? path.resolve(process.env.BASELINE_DIR) : path.join(BACKEND, 'live-baseline');
  const sqlPath = path.join(dir, 'staging-schema.sql'); const manifestPath = path.join(dir, 'staging-schema.manifest.json');
  if (!fs.existsSync(sqlPath) || !fs.existsSync(manifestPath)) return fail('step A has not been run: staging-schema.sql and its manifest are not in the baseline folder.', 2);
  if (!process.stdin.isTTY) return fail('this needs a terminal, so a person types the confirmation.', 2);

  const sqlText = fs.readFileSync(sqlPath, 'utf8');
  let manifest = null; try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch { /* reported by the check */ }
  const folderNames = fs.readdirSync(path.join(BACKEND, 'prisma', 'migrations'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

  // the checks that need no database run first, then the emptiness, then the confirmation (all inside runBaseline's order except the prompt, which is asked once the cheap refusals are past)
  const { sqlFileProblem, manifestProblem, migrationFolders } = require('./baseline-lib');
  const early = sqlFileProblem(sqlText) || (() => { try { return manifestProblem(manifest, sqlText, migrationFolders(folderNames)); } catch (e) { return e.message; } })();
  if (early) return fail(early, 2);

  const { PrismaClient } = require('@prisma/client');
  const client = new PrismaClient({ datasourceUrl: live.DIRECT_URL, log: [] });
  const q = async (strings, ...v) => client.$queryRaw(strings, ...v);
  const pg = pgEnvFromUrl(live.DIRECT_URL); const mask = maskerFor(pg);
  const prismaEnv = { ...process.env, DATABASE_URL: live.DIRECT_URL, DIRECT_URL: live.DIRECT_URL };
  const cli = (args) => spawnSync(process.execPath, [PRISMA, ...args], { cwd: BACKEND, encoding: 'utf8', env: prismaEnv });

  try {
    // LIVE is asked for only when the database is empty, so a wrong database is refused without even a prompt
    const { emptinessProblem } = require('./baseline-lib');
    const [{ n }] = await q`SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'`;
    const [{ m }] = await q`SELECT count(*)::int AS m FROM pg_tables WHERE schemaname = 'public' AND tablename = '_prisma_migrations'`;
    const why = emptinessProblem({ publicTables: Number(n), hasMigrationsTable: Number(m) > 0 });
    if (why) return fail(why, 4);
    if (!applyConfirmed(await ask('This writes the whole schema to the LIVE database. Type LIVE to continue: '))) return fail('not confirmed; nothing was written.', 2);

    const io = {
      publicTables: async () => Number((await q`SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'`)[0].n),
      hasMigrationsTable: async () => Number((await q`SELECT count(*)::int AS m FROM pg_tables WHERE schemaname = 'public' AND tablename = '_prisma_migrations'`)[0].m) > 0,
      extensionSchemaExists: async () => Number((await q`SELECT count(*)::int AS n FROM pg_namespace WHERE nspname = ${EXTENSION_SCHEMA}`)[0].n) === 1,
      extensionsPresent: async () => (await q`SELECT extname FROM pg_extension`).map((r) => r.extname),
      createExtension: async (name) => {   // name is from the fixed list in baseline-lib
        const r = spawnSync('psql', ['-v', 'ON_ERROR_STOP=1', '-q', '-c', `CREATE EXTENSION IF NOT EXISTS "${name}" WITH SCHEMA ${EXTENSION_SCHEMA}`], { env: { ...process.env, ...pg }, encoding: 'utf8' });
        if (r.status !== 0) throw new Error('psql failed');
      },
      applySql: async (text) => {   // the rewritten text goes to psql on stdin: the dump file on disk is never changed
        const r = spawnSync('psql', ['-v', 'ON_ERROR_STOP=1', '--single-transaction', '-q', '-o', process.platform === 'win32' ? 'NUL' : '/dev/null', '-f', '-'], { input: text, maxBuffer: 1 << 28, env: { ...process.env, ...pg }, encoding: 'utf8' });
        if (r.status !== 0) { console.error(mask(String(r.stderr || '')).split('\n').slice(0, 3).join(' | ').slice(0, 300)); throw new Error('psql failed'); }
      },
      resolveApplied: async (name) => { const r = cli(['migrate', 'resolve', '--applied', name]); if (r.status !== 0) throw new Error('resolve failed'); },
      rlsOffCount: async () => Number((await q`SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace WHERE s.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity`)[0].n),
      drift: async () => {
        const r = cli(['migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma', '--to-schema-datamodel', 'prisma/schema.prisma', '--script']);
        if (r.status !== 0) throw new Error('drift comparison could not run');
        return classifyDrift(r.stdout || '');
      },
    };
    const r = await runBaseline({ sqlText, manifest, folderNames, io, say: (s) => console.log(s) });
    process.exitCode = r.ok ? 0 : 1;
  } catch (e) {
    console.error(`The baseline failed (${e && e.code ? e.code : 'error'}). Nothing printed contains a connection string.`);
    process.exitCode = 1;
  } finally { await client.$disconnect().catch(() => undefined); }
})();
