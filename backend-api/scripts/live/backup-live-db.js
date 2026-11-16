#!/usr/bin/env node
'use strict';
/**
 * Backup of the V3 LIVE database to an ENCRYPTED file, with rotation (job L5). Run on the server (needs pg_dump and openssl, and a pg_dump of the same major version as the database):
 *
 *   node scripts/live/backup-live-db.js
 *
 * Reads, from the environment (the same .env.live; export it to the shell first, see docs/v3/V3_LIVE_ENVIRONMENT.md):
 *   DIRECT_URL              the live database (a staging or test database is refused, like the API's startup check)
 *   BACKUP_DIR              the folder for the backups (absolute path, outside the repository)
 *   BACKUP_PASSPHRASE_FILE  a file that holds the passphrase (at least 20 characters; on Linux not readable by group or others)
 *   BACKUP_KEEP             how many backups to keep (default 14)
 *
 * pg_dump gets the connection through PG* variables (never a password on the command line); the dump is piped straight into openssl (AES-256-CBC, PBKDF2) so a plain copy never touches the disk;
 * the finished file is checked by decrypting it and listing its contents with pg_restore; only then is it renamed into place and the old ones rotated. Nothing printed contains the connection or the passphrase.
 * Needs `npm run build` first (it uses the startup check in dist).
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { pgEnvFromUrl, backupFileName, selectExpired, keepFrom, passphraseProblem, maskerFor } = require('./backup-lib');

const fail = (msg, code = 1) => { console.error(`BACKUP FAILED: ${msg}`); process.exitCode = code; };

(async () => {
  const { checkDatabaseUrls } = require(path.join(__dirname, '..', '..', 'dist', 'src', 'common', 'startup-check'));
  const faults = checkDatabaseUrls({ DATABASE_URL: process.env.DIRECT_URL, DIRECT_URL: process.env.DIRECT_URL });
  if (faults.length) return fail(`DIRECT_URL ${faults[0].problem}.`, 3);
  const dir = process.env.BACKUP_DIR;
  if (!dir || !path.isAbsolute(dir)) return fail('BACKUP_DIR must be an absolute path.', 2);
  if (path.resolve(dir).startsWith(path.resolve(__dirname, '..', '..'))) return fail('BACKUP_DIR must be outside the repository.', 2);
  const passFile = process.env.BACKUP_PASSPHRASE_FILE;
  if (!passFile || !fs.existsSync(passFile)) return fail('BACKUP_PASSPHRASE_FILE is not set or does not exist.', 2);
  const why = passphraseProblem(fs.readFileSync(passFile, 'utf8'));
  if (why) return fail(why, 2);
  if (process.platform !== 'win32' && (fs.statSync(passFile).mode & 0o077) !== 0) return fail('BACKUP_PASSPHRASE_FILE must not be readable by group or others (chmod 600).', 2);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

  const env = pgEnvFromUrl(process.env.DIRECT_URL);
  const mask = maskerFor(env);
  const name = backupFileName(new Date());
  const partial = path.join(dir, `${name}.partial`);
  const final = path.join(dir, name);
  const penv = { ...process.env, ...env };
  const enc = ['enc', '-aes-256-cbc', '-pbkdf2', '-iter', '600000', '-salt', '-pass', `file:${passFile}`];

  // pg_dump | openssl enc > file.partial
  const out = fs.createWriteStream(partial, { mode: 0o600 });
  const dump = spawn('pg_dump', ['--format=custom', '--no-owner', '--no-acl', '--lock-wait-timeout=60000'], { env: penv, stdio: ['ignore', 'pipe', 'pipe'] });
  const crypt = spawn('openssl', enc, { stdio: ['pipe', 'pipe', 'pipe'] });
  let errors = '';
  dump.stderr.on('data', (d) => { errors += d; }); crypt.stderr.on('data', (d) => { errors += d; });
  dump.stdout.pipe(crypt.stdin); crypt.stdout.pipe(out);
  const codes = await Promise.all([
    new Promise((r) => { dump.on('error', (e) => { errors += e.message; r(127); }); dump.on('close', r); }),
    new Promise((r) => { crypt.on('error', (e) => { errors += e.message; r(127); }); crypt.on('close', r); }),
    new Promise((r) => out.on('close', () => r(0))),
  ]);
  if (codes[0] !== 0 || codes[1] !== 0) { fs.rmSync(partial, { force: true }); return fail(`pg_dump exit ${codes[0]}, openssl exit ${codes[1]}. ${mask(errors).trim().slice(0, 500)}`); }
  if (fs.statSync(partial).size < 1024) { fs.rmSync(partial, { force: true }); return fail('the backup is empty or far too small; nothing was kept.'); }

  // verify: decrypt and list the archive's contents
  const dec = spawn('openssl', ['enc', '-d', ...enc.slice(1), '-in', partial], { stdio: ['ignore', 'pipe', 'pipe'] });
  const list = spawn('pg_restore', ['--list'], { stdio: ['pipe', 'ignore', 'pipe'] });
  dec.stdout.pipe(list.stdin);
  const vcodes = await Promise.all([new Promise((r) => dec.on('close', r)), new Promise((r) => list.on('close', r))]);
  if (vcodes[0] !== 0 || vcodes[1] !== 0) { fs.rmSync(partial, { force: true }); return fail('the finished file could not be decrypted and read back; nothing was kept.'); }
  fs.renameSync(partial, final); fs.chmodSync(final, 0o600);

  // rotate: only files named like ours, only beyond the newest BACKUP_KEEP
  const expired = selectExpired(fs.readdirSync(dir), keepFrom(process.env.BACKUP_KEEP));
  for (const f of expired) fs.rmSync(path.join(dir, f), { force: true });
  console.log(`Backup written: ${name} (${Math.round(fs.statSync(final).size / 1024)} KiB), verified. Rotated out: ${expired.length}.`);
})().catch((e) => fail(`unexpected error (${e && e.code ? e.code : 'error'}).`));
