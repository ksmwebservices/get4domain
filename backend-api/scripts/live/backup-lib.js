'use strict';
/** The pure parts of the live database backup (job L5): which settings pg_dump gets, the file name, which old backups to drop, whether the passphrase is acceptable. No clock, no disk, no database. */

const PREFIX = 'v3live-';
const SUFFIX = '.dump.enc';
const NAME_RE = /^v3live-(\d{8})-(\d{6})Z\.dump\.enc$/;
const MIN_PASSPHRASE = 20;
const DEFAULT_KEEP = 14;

/** A host that is never on the public internet: a container name (no dot), localhost, or a private IPv4 address (10.x, 172.16-31.x, 192.168.x). */
function isPrivateHost(host) {
  const h = String(host).toLowerCase();
  if (h === 'localhost' || h === '[::1]') return true;
  if (h.startsWith('[')) return false;   // any other IPv6 literal is not treated as private
  if (!h.includes('.')) return h.length > 0;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

const SSL_MODES = ['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'];
const SSL_ENFORCING = ['require', 'verify-ca', 'verify-full'];

/** The TLS setting for a host: the URL's sslmode is honoured, but a mode that does not force TLS (disable, allow, prefer) is accepted only for a private host. No sslmode means require. Throws without ever repeating the URL. */
function sslModeFor(host, requested) {
  if (requested === null || requested === undefined || requested === '') return 'require';
  if (!SSL_MODES.includes(requested)) throw new Error('The connection has an unknown sslmode.');
  if (SSL_ENFORCING.includes(requested) || isPrivateHost(host)) return requested;
  throw new Error(`sslmode=${requested} is accepted only for a container name or a private address; this host is public, so TLS is required.`);
}

/** The connection as the PG* variables pg_dump reads, so no password is ever in a command line (where `ps` would show it). */
function pgEnvFromUrl(url) {
  const u = new URL(url);
  return {
    PGHOST: u.hostname, PGPORT: u.port || '5432', PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres', PGSSLMODE: sslModeFor(u.hostname, u.searchParams.get('sslmode')),
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

module.exports = { pgEnvFromUrl, isPrivateHost, sslModeFor, backupFileName, selectExpired, keepFrom, passphraseProblem, maskerFor, NAME_RE, DEFAULT_KEEP, MIN_PASSPHRASE };
