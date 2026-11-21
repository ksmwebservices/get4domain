#!/usr/bin/env node
'use strict';
/**
 * One-time bootstrap of the first SUPER_ADMIN of the V3 LIVE database (job L4).
 *
 *   docker compose -f docker-compose.v3live.yml --env-file .env.live run --rm -it api node scripts/bootstrap-super-admin.js
 *
 * It asks for the email and the password AT THE PROMPT. It takes no arguments (an argument is refused), reads no file and no environment variable for either, never prints or logs the password, and
 * refuses to run when an administrator already exists. It refuses a staging or test database (the same rule as the live API's startup check). Needs the built app (dist) and DATABASE_URL or DIRECT_URL.
 */
const path = require('path');
const readline = require('readline');
const { bootstrapSuperAdmin } = require('./bootstrap-super-admin-lib');

/** A prompt that does not echo what is typed. */
function askSecret(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    const write = rl._writeToOutput;
    rl._writeToOutput = function (s) { if (!muted) write.call(rl, s); };
    process.stdout.write(question);
    muted = true;
    rl.question('', (answer) => { muted = false; process.stdout.write('\n'); rl.close(); resolve(answer); });
  });
}
function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.question(question, (answer) => { rl.close(); resolve(answer); });
  });
}

(async () => {
  if (process.argv.length > 2) { console.error('This script takes no arguments: the email and the password are asked for at the prompt only.'); process.exitCode = 2; return; }
  if (!process.stdin.isTTY || !process.stdout.isTTY) { console.error('Run this in a terminal (docker compose run -it ...): it asks for the password at a prompt and reads it from nowhere else.'); process.exitCode = 2; return; }

  const { checkDatabaseUrls } = require(path.join(__dirname, '..', 'dist', 'src', 'common', 'startup-check'));
  const faults = checkDatabaseUrls(process.env);
  if (faults.length) { console.error(`Refused: ${faults.map((p) => `${p.name} ${p.problem}`).join('; ')}.`); process.exitCode = 3; return; }

  const { PrismaClient } = require('@prisma/client');
  const bcrypt = require('bcryptjs');
  const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL, log: [] });
  try {
    const r = await bootstrapSuperAdmin({ prisma, ask, askSecret, hash: (pw) => bcrypt.hash(pw, 10), say: (s) => console.log(s) });
    process.exitCode = r.ok ? 0 : 1;
  } catch (e) {
    console.error(`The bootstrap failed (${e && e.code ? e.code : 'error'}). Nothing was printed that could contain a secret.`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
})();
