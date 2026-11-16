#!/usr/bin/env node
'use strict';
/**
 * STEP A of the live baseline (job M2): dump the schema of the STAGING database into a local file. Run on the owner's PC (needs pg_dump, of the same major version as the database, and the Prisma CLI of this
 * checkout: `npm ci`).
 *
 *   node scripts/live/dump-staging-schema.js
 *
 * It asks, at a prompt that does not echo, for the DIRECT connection string of the STAGING database (port 5432). Nothing is read from an argument, a file or the environment, and the string is never printed
 * or stored. It refuses anything that is not the staging project (production and the live project are refused). Before it dumps, it checks that staging has EVERY migration of this checkout applied and has no
 * drift beyond the two documented items, because the live database will be marked as having them all.
 *
 * It writes two files into BASELINE_DIR (default backend-api/live-baseline, which is in .gitignore and is never committed): staging-schema.sql (the structure: pg_dump --schema-only --no-owner --no-privileges,
 * public schema, without the migration history table) and staging-schema.manifest.json (a table count, the number of migration folders and a hash). The schema file is never printed; this prints counts only.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync, spawn } = require('child_process');
const { askSecret } = require('./prompt');
const { pgEnvFromUrl, maskerFor } = require('./backup-lib');
const { dumpArgs, migrationFolders, sourceProblem, sqlFileProblem, manifestFor } = require('./baseline-lib');
const guard = require('../staging/guard');
const { classifyDrift } = require('../staging/drift-allowlist');

const BACKEND = path.resolve(__dirname, '..', '..');
const PRISMA = path.join(BACKEND, 'node_modules', 'prisma', 'build', 'index.js');
const fail = (msg, code) => { console.error(`DUMP REFUSED: ${msg}`); process.exitCode = code; };

(async () => {
  if (process.argv.length > 2) return fail('this script takes no arguments: the connection string is asked for at the prompt only.', 2);
  if (!process.stdin.isTTY || !process.stdout.isTTY) return fail('run this in a terminal: it asks for the connection string at a prompt.', 2);
  const dir = process.env.BASELINE_DIR ? path.resolve(process.env.BASELINE_DIR) : path.join(BACKEND, 'live-baseline');
  if (process.env.BASELINE_DIR && dir.startsWith(path.resolve(BACKEND, '..')) && !dir.startsWith(path.join(BACKEND, 'live-baseline'))) return fail('BASELINE_DIR must be outside the repository, or the default folder (which git ignores).', 2);

  const url = String((await askSecret('Direct connection string of the STAGING database (not shown): ')).trim());
  let parsed; try { parsed = new URL(url); } catch { return fail('that is not a connection string.', 2); }
  if (!/^postgres(ql)?:$/.test(parsed.protocol) || !parsed.password) return fail('that is not a postgres connection string with a password.', 2);
  const cfg = JSON.parse(fs.readFileSync(guard.CONFIG, 'utf8'));
  const ref = guard.projectRef(url);
  const why = sourceProblem(ref ? guard.sha(ref) : null, cfg);
  if (why) return fail(why, 3);

  const pg = pgEnvFromUrl(url); const mask = maskerFor(pg);
  const prismaEnv = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
  const prisma = (args) => spawnSync(process.execPath, [PRISMA, ...args], { cwd: BACKEND, encoding: 'utf8', env: prismaEnv });

  const st = prisma(['migrate', 'status']);
  if (st.status !== 0) return fail('staging does not have every migration of this checkout applied (prisma migrate status). Apply them to staging first (npm run db:staging:migrate-deploy), then run this again.', 4);
  const df = prisma(['migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma', '--to-schema-datamodel', 'prisma/schema.prisma', '--script']);
  if (df.status !== 0) return fail('the drift comparison could not run.', 4);
  const drift = classifyDrift(df.stdout || '');
  if (drift.unexpected.length) return fail(`staging differs from prisma/schema.prisma in ${drift.unexpected.length} way(s) beyond the documented ones (npm run db:staging:drift shows them). Fix that first.`, 4);

  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const sqlPath = path.join(dir, 'staging-schema.sql'); const manifestPath = path.join(dir, 'staging-schema.manifest.json');
  const partial = `${sqlPath}.partial`;
  const out = fs.createWriteStream(partial, { mode: 0o600 });
  const dump = spawn('pg_dump', dumpArgs(), { env: { ...process.env, ...pg }, stdio: ['ignore', 'pipe', 'pipe'] });
  let errors = ''; dump.stderr.on('data', (d) => { errors += d; }); dump.stdout.pipe(out);
  const code = await new Promise((r) => { dump.on('error', (e) => { errors += e.message; r(127); }); dump.on('close', r); });
  await new Promise((r) => out.close(r));
  if (code !== 0) { fs.rmSync(partial, { force: true }); return fail(`pg_dump failed (exit ${code}). ${mask(errors).trim().slice(0, 400)}`, 5); }
  const text = fs.readFileSync(partial, 'utf8');
  const bad = sqlFileProblem(text);
  if (bad) { fs.rmSync(partial, { force: true }); return fail(bad, 5); }
  fs.renameSync(partial, sqlPath); fs.chmodSync(sqlPath, 0o600);
  const folders = migrationFolders(fs.readdirSync(path.join(BACKEND, 'prisma', 'migrations')));
  const manifest = manifestFor(text, folders.length);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  console.log(`Schema dumped: ${manifest.tables} tables, ${folders.length} migration folders, ${drift.allowed.length} documented drift item(s) in staging. Files written to the baseline folder (never commit them).`);
})().catch((e) => fail(`unexpected error (${e && e.code ? e.code : 'error'}).`, 1));
