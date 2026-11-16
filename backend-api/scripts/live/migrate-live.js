#!/usr/bin/env node
'use strict';
/**
 * Migrations on the LIVE database only (job L6). The staging commands (db:staging:*) refuse anything but staging; this one is the opposite door: it refuses a staging, test or local database (the live
 * API's own rule), and a deploy needs the word LIVE typed in a terminal.
 *
 *   node scripts/live/migrate-live.js status     which migrations are applied and which are pending (changes nothing)
 *   node scripts/live/migrate-live.js deploy     applies the pending migrations, in order (prisma migrate deploy); asks you to type LIVE first
 *
 * Reads DATABASE_URL and DIRECT_URL from the environment (export .env.live to the shell first). Runs the Prisma CLI of this checkout (npm ci installs it). Never prints a connection string.
 */
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');
const { liveSeedEnv, applyConfirmed } = require('./live-env-lib');

const fail = (msg, code) => { console.error(`MIGRATE REFUSED: ${msg}`); process.exitCode = code; };
const ask = (q) => new Promise((resolve) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, (a) => { rl.close(); resolve(a); }); });

(async () => {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!['status', 'deploy'].includes(cmd) || rest.length) return fail('say exactly one of: status, deploy.', 2);
  const { checkDatabaseUrls } = require(path.join(__dirname, '..', '..', 'dist', 'src', 'common', 'startup-check'));
  const live = liveSeedEnv(process.env, checkDatabaseUrls);
  if (!live.ok) return fail(live.problems.join('; ') + '.', 3);
  if (cmd === 'deploy') {
    if (!process.stdin.isTTY) return fail('deploy needs a terminal, so a person types the confirmation.', 2);
    if (!applyConfirmed(await ask('This applies migrations to the LIVE database. Type LIVE to continue: '))) return fail('not confirmed; nothing was applied.', 2);
  }
  const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['prisma', 'migrate', cmd], { cwd: path.join(__dirname, '..', '..'), env: process.env, encoding: 'utf8', shell: process.platform === 'win32' });
  process.stdout.write(live.mask(r.stdout || ''));
  process.stderr.write(live.mask(r.stderr || ''));
  process.exitCode = r.status === null ? 1 : r.status;
})();
