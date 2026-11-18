'use strict';
/**
 * The pure parts of the live schema baseline (job M2), and the one function that runs the steps in their fixed order over injected functions (so a test can drive it with no database).
 *
 * Why a baseline: the early migration history cannot be replayed on an empty database (see V3_PRODUCTION_MIGRATION_STATE.md), so `migrate deploy` cannot build a NEW live database. Instead the schema of
 * the STAGING database (which has every migration applied and no unexpected drift) is dumped once, applied to the empty live database, and every migration folder is then marked as applied.
 */
const crypto = require('crypto');

/** The extensions the schema needs, created in Supabase's `extensions` schema: pgcrypto and uuid-ossp (ids, hashing) and pg_trgm (the directory name search index, migration 20261107100000). */
const REQUIRED_EXTENSIONS = ['pgcrypto', 'uuid-ossp', 'pg_trgm'];
const EXTENSION_SCHEMA = 'extensions';
const MIGRATION_DIR = /^\d{14}_[A-Za-z0-9_]+$/;

/** The pg_dump arguments of step A: structure only, no owners, no grants, only the public schema, and not the migration history table (Prisma makes that itself when the folders are marked applied). */
function dumpArgs() {
  return ['--schema-only', '--no-owner', '--no-privileges', '--schema=public', '--exclude-table=public._prisma_migrations'];
}

/** The migration folders to mark as applied, oldest first. Only real migration folders: anything else in the directory (the lock file, a stray note) is ignored. Throws when there are none. */
function migrationFolders(names) {
  const dirs = names.filter((n) => MIGRATION_DIR.test(n)).sort();
  if (dirs.length === 0) throw new Error('no migration folder found');
  return dirs;
}

/** Extensions still to create, from the names already installed. */
const extensionsToCreate = (have) => REQUIRED_EXTENSIONS.filter((e) => !have.includes(e));

/** null when the database is empty enough to baseline: no table in `public` and no migration history table. */
function emptinessProblem({ publicTables, hasMigrationsTable }) {
  if (hasMigrationsTable) return 'The database already has a migration history table: it is not empty. A baseline only goes onto an EMPTY database (a new project).';
  if (!Number.isInteger(publicTables)) return 'Could not count the tables in the public schema.';
  if (publicTables !== 0) return `The database already has ${publicTables} table(s) in the public schema: it is not empty. A baseline only goes onto an EMPTY database (a new project).`;
  return null;
}

/** Step A's source must be the STAGING project (its ref's hash is on the guard's allow list and not on the deny list): never production, never live. */
function sourceProblem(refHash, cfg) {
  if (!refHash) return 'The connection string is not a Supabase connection string, so its project cannot be recognised.';
  if (cfg.deniedProjectRefHashes.includes(refHash)) return 'That is a DENIED (production) project. The schema is taken from staging only.';
  if (!cfg.allowedProjectRefHashes.includes(refHash)) return 'That is not the staging project. The schema is taken from staging only.';
  return null;
}

const FORBIDDEN = [
  [/^\s*(DROP|TRUNCATE)\s/im, 'a DROP or TRUNCATE statement'], [/^\s*(INSERT\s+INTO|COPY\s|DELETE\s+FROM|UPDATE\s+\S+\s+SET)\b/im, 'a data statement'],
  [/^\s*(CREATE|ALTER|DROP)\s+(ROLE|USER|DATABASE)\b/im, 'a role or database statement'], [/^\\(?!restrict\b|unrestrict\b)\S/m, 'a psql command'],
  [/^\s*CREATE\s+SCHEMA\s+(?!(?:IF NOT EXISTS\s+)?"?public"?\b)/im, 'a schema other than public'],
];
/** null when the text is a schema-only dump of the public schema; never repeats any of its content. */
function sqlFileProblem(text) {
  if (typeof text !== 'string' || text.length < 1000) return 'The schema file is missing or too small to be a schema dump.';
  const tables = tableCountOf(text);
  if (tables < 100) return `The schema file has only ${tables} tables; it does not look like the full schema.`;
  for (const [re, what] of FORBIDDEN) if (re.test(text)) return `The schema file contains ${what}, which a schema-only dump never has. It was not applied.`;
  return null;
}

/** The number of CREATE TABLE statements in a dump. */
const tableCountOf = (text) => (String(text).match(/^CREATE TABLE /gm) || []).length;
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

/** What step A writes next to the dump, and what step B checks the file against. Counts and a hash only. */
const manifestFor = (sqlText, migrations) => ({ tables: tableCountOf(sqlText), migrations, sha256: sha256(sqlText) });

/** null when the file is the one step A wrote and the repository still has as many migration folders as then. */
function manifestProblem(manifest, sqlText, folders) {
  if (!manifest || typeof manifest !== 'object') return 'The manifest file is missing; run step A again.';
  if (manifest.sha256 !== sha256(sqlText)) return 'The schema file is not the one step A wrote (its hash differs). Run step A again.';
  if (manifest.tables !== tableCountOf(sqlText)) return 'The schema file does not match its manifest. Run step A again.';
  if (manifest.migrations !== folders.length) return `The dump was taken when the repository had ${manifest.migrations} migration folders; it has ${folders.length} now. Run step A again from this checkout.`;
  return null;
}

/**
 * The steps of step B, in their fixed order, over injected functions. Stops at the FIRST failure and says which. Prints (through `say`) counts only.
 * io: { publicTables, hasMigrationsTable, extensionsPresent, extensionSchemaExists, createExtension(name), applySql(), resolveApplied(name), rlsOffCount, drift() }
 */
async function runBaseline({ sqlText, manifest, folderNames, io, say = () => undefined }) {
  const fail = (step, why) => { say(`BASELINE STOPPED at ${step}: ${why}`); return { ok: false, step, why }; };
  const counts = {};

  const bad = sqlFileProblem(sqlText); if (bad) return fail('schema file', bad);
  let folders; try { folders = migrationFolders(folderNames); } catch (e) { return fail('migration folders', e.message); }
  const mp = manifestProblem(manifest, sqlText, folders); if (mp) return fail('manifest', mp);

  // refuse anything that is not an empty database BEFORE a single change
  const empty = emptinessProblem({ publicTables: await io.publicTables(), hasMigrationsTable: await io.hasMigrationsTable() });
  if (empty) return fail('database not empty', empty);

  if (!(await io.extensionSchemaExists())) return fail('extensions', `The schema "${EXTENSION_SCHEMA}" does not exist (a Supabase project has it).`);
  const missing = extensionsToCreate(await io.extensionsPresent());
  for (const name of missing) { try { await io.createExtension(name); } catch { return fail('extensions', `could not create the extension ${name}`); } }
  counts.extensionsCreated = missing.length;

  try { await io.applySql(); } catch { return fail('apply schema', 'the schema file did not apply (it ran in one transaction, so nothing of it was kept)'); }
  counts.tables = await io.publicTables();
  if (counts.tables !== manifest.tables) return fail('table count', `expected ${manifest.tables} tables, found ${counts.tables}. Do not use this database: create a new project and start again.`);

  counts.resolved = 0;
  for (const name of folders) {
    try { await io.resolveApplied(name); } catch { return fail('mark applied', `could not mark migration ${counts.resolved + 1} of ${folders.length} as applied. Do not use this database: create a new project and start again.`); }
    counts.resolved += 1;
  }

  counts.rlsOff = await io.rlsOffCount();
  if (counts.rlsOff !== 0) return fail('row level security', `${counts.rlsOff} table(s) have row level security off`);
  const d = await io.drift();
  counts.driftAllowed = d.allowed.length; counts.driftUnexpected = d.unexpected.length;
  if (d.unexpected.length) return fail('drift', `${d.unexpected.length} difference(s) between the database and prisma/schema.prisma beyond the ${d.allowed.length} documented ones`);

  say(`Baseline done: ${counts.tables} tables, ${counts.extensionsCreated} extension(s) created, ${counts.resolved} of ${folders.length} migrations marked applied, ${counts.rlsOff} tables without row level security, ${counts.driftAllowed} documented drift item(s), ${counts.driftUnexpected} unexpected.`);
  return { ok: true, counts };
}

/** Why `prisma migrate status` exited non-zero, from its (already masked) output: 'connect' when the database could not be reached or logged into (the check never ran), 'pending' when it ran and migrations differ, else 'other'. */
function statusFailureKind(text) {
  const t = String(text || '');
  if (/P10(00|01|02|03|08|11|17)|ENOTFOUND|ETIMEDOUT|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|authentication failed|Can't reach database server|Timed out/i.test(t)) return 'connect';
  if (/have not yet been applied|following migration|not found locally|failed migrations|Database schema is not up to date/i.test(t)) return 'pending';
  return 'other';
}

/** The refusal text for a failed `migrate status`, never containing the output itself. */
function statusRefusal(kind) {
  if (kind === 'connect') return 'could not connect to staging with that connection string, so the migration check did not run. Use the session-pooler DIRECT_URL (IPv4, port 5432) that npm run db:staging:migrate-status uses: run this with --from-staging-env, or paste that same string. A db.<ref>.supabase.co host is IPv6-only and fails from many PCs.';
  if (kind === 'pending') return 'staging does not have every migration of this checkout applied (prisma migrate status). Apply them to staging first (npm run db:staging:migrate-deploy), then run this again.';
  return 'prisma migrate status failed for a reason other than pending migrations (run npm run db:staging:migrate-status to see it).';
}

/** The staging direct connection string from the loader run.js uses (guard.loadStagingEnv: .env.staging at the repo root, or STAGING_* variables; refuses non-staging). Returns the string only; the caller must never print it. */
const stagingDirectUrl = (loadStagingEnv) => loadStagingEnv().DIRECT_URL;

/** Trim a typed or pasted string and drop one pair of surrounding quotes. */
const cleanUrl = (s) => String(s).trim().replace(/^(['"])(.*)\1$/, '$2');

module.exports = { statusFailureKind, statusRefusal, stagingDirectUrl, cleanUrl, REQUIRED_EXTENSIONS, EXTENSION_SCHEMA, dumpArgs, migrationFolders, extensionsToCreate, emptinessProblem, sourceProblem, sqlFileProblem, tableCountOf, sha256, manifestFor, manifestProblem, runBaseline };
