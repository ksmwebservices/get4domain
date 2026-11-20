#!/usr/bin/env node
'use strict';
/**
 * Runs one of the V3 data loaders (the seed-v3-*.js scripts) against the LIVE database (job L6). Those scripts are written for STAGING: they ask the staging guard for their connection, and the guard
 * refuses everything but the staging project. This runner puts the live connection in the guard's place for ONE run, after the same refusals the live API applies (a staging or test database is refused).
 *
 *   node scripts/live/seed-live.js seed-v3-plans.js             DRY RUN (every loader's default: nothing is written)
 *   node scripts/live/seed-live.js seed-v3-plans.js --apply     writes the missing rows; asks you to type LIVE first, in a terminal
 *
 * Each loader keeps its own rules: a row that exists is never changed, nothing is deleted, a dry run is the default. Reads DIRECT_URL / DATABASE_URL from the environment (export .env.live first).
 * Needs `npm run build` first. Output never contains a connection string (the loaders mask them).
 */
const path = require('path');
const readline = require('readline');
const { liveSeedEnv, SEED_SCRIPTS, applyConfirmed } = require('./live-env-lib');

const fail = (msg, code) => { console.error(`SEED REFUSED: ${msg}`); process.exitCode = code; };
const ask = (q) => new Promise((resolve) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, (a) => { rl.close(); resolve(a); }); });

(async () => {
  const [name, ...flags] = process.argv.slice(2);
  if (!name || !SEED_SCRIPTS.includes(name)) return fail(`name one loader: ${SEED_SCRIPTS.join(', ')}.`, 2);
  if (flags.some((f) => !['--apply', '--offline'].includes(f))) return fail('the only flags are --apply and --offline.', 2);
  const apply = flags.includes('--apply');
  if (apply && flags.includes('--offline')) return fail('--offline never writes; use --apply on its own.', 2);

  if (!flags.includes('--offline')) {
    const { checkDatabaseUrls } = require(path.join(__dirname, '..', '..', 'dist', 'src', 'common', 'startup-check'));
    const live = liveSeedEnv(process.env, checkDatabaseUrls);
    if (!live.ok) return fail(live.problems.join('; ') + '.', 3);
    if (apply) {
      if (!process.stdin.isTTY) return fail('--apply needs a terminal, so a person types the confirmation.', 2);
      if (!applyConfirmed(await ask('This WRITES to the LIVE database. Type LIVE to continue: '))) return fail('not confirmed; nothing was written.', 2);
    }
    process.env.G4D_SEED_CONFIRMED = '1';   // the typed LIVE above is the confirmation a loader may rely on
    // for this one run the guard answers with the live connection (the staging guard file itself is not changed)
    const guard = require(path.join(__dirname, '..', 'staging', 'guard'));
    guard.loadStagingEnv = () => ({ DATABASE_URL: live.DATABASE_URL, DIRECT_URL: live.DIRECT_URL, mask: live.mask });
  }
  process.argv = [process.argv[0], path.join(__dirname, '..', name), ...flags];
  require(path.join(__dirname, '..', name));
})();
