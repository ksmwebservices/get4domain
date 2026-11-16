'use strict';
/** The pure parts of the live database backup (job L5): which settings pg_dump gets, the file name, which old backups to drop, whether the passphrase is acceptable. No clock, no disk, no database. */

const PREFIX = 'v3live-';
const SUFFIX = '.dump.enc';
const NAME_RE = /^v3live-(\d{8})-(\d{6})Z\.dump\.enc$/;
const MIN_PASSPHRASE = 20;
const DEFAULT_KEEP = 14;

/** The connection as the PG* variables pg_dump reads, so no password is ever in a command line (where `ps` would show it). */
function pgEnvFromUrl(url) {
  const u = new URL(url);
  return {
    PGHOST: u.hostname, PGPORT: u.port || '5432', PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres', PGSSLMODE: 'require',
  };
}

/** v3live-20261120-031500Z.dump.enc (UTC, so names sort by time). */
function backupFileName(now) {
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${PREFIX}${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}-${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}Z${SUFFIX}`;
}

/** The names to delete: backups of ours beyond the newest `keep`. A file that is not named like ours is never listed, so nothing else in the folder can be deleted. */
function selectExpired(names, keep) {
  const k = Number.isInteger(keep) && keep >= 1 ? keep : DEFAULT_KEEP;
  return names.filter((n) => NAME_RE.test(n)).sort().reverse().slice(k);
}

/** How many to keep, from BACKUP_KEEP: a whole number from 1 to 3650, else the default. */
function keepFrom(value) {
  const n = Number(value);
  return value !== undefined && value !== '' && Number.isInteger(n) && n >= 1 && n <= 3650 ? n : DEFAULT_KEEP;
}

/** null when the passphrase (the file's text) is long enough. Never repeats it. */
function passphraseProblem(text) {
  return typeof text === 'string' && text.trim().length >= MIN_PASSPHRASE ? null : `The passphrase file must hold at least ${MIN_PASSPHRASE} characters.`;
}

/** Replaces every secret in a text with *** (the password, the user and the host of the connection). */
function maskerFor(env) {
  const secrets = [env.PGPASSWORD, env.PGUSER, env.PGHOST].filter((s) => s && s.length >= 3).sort((a, b) => b.length - a.length);
  return (text) => secrets.reduce((acc, s) => acc.split(s).join('***'), String(text));
}

module.exports = { pgEnvFromUrl, backupFileName, selectExpired, keepFrom, passphraseProblem, maskerFor, NAME_RE, DEFAULT_KEEP, MIN_PASSPHRASE };
