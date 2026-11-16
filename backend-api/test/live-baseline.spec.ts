import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

/* eslint-disable @typescript-eslint/no-require-imports */
interface Io { publicTables: () => Promise<number>; hasMigrationsTable: () => Promise<boolean>; extensionSchemaExists: () => Promise<boolean>; extensionsPresent: () => Promise<string[]>; createExtension: (n: string) => Promise<void>; applySql: () => Promise<void>; resolveApplied: (n: string) => Promise<void>; rlsOffCount: () => Promise<number>; drift: () => Promise<{ allowed: string[]; unexpected: string[] }> }
const lib = require('../scripts/live/baseline-lib') as {
  REQUIRED_EXTENSIONS: string[]; dumpArgs: () => string[]; migrationFolders: (n: string[]) => string[]; extensionsToCreate: (h: string[]) => string[];
  emptinessProblem: (c: { publicTables: unknown; hasMigrationsTable: boolean }) => string | null; sourceProblem: (h: string | null, c: { allowedProjectRefHashes: string[]; deniedProjectRefHashes: string[] }) => string | null;
  sqlFileProblem: (t: unknown) => string | null; tableCountOf: (t: string) => number; sha256: (t: string) => string; manifestFor: (t: string, m: number) => { tables: number; migrations: number; sha256: string };
  manifestProblem: (m: unknown, t: string, f: string[]) => string | null;
  runBaseline: (d: { sqlText: string; manifest: unknown; folderNames: string[]; io: Io; say?: (s: string) => void }) => Promise<{ ok: boolean; step?: string; why?: string; counts?: Record<string, number> }>;
};

/** Job M2: the live baseline, its pure parts and its fixed order. */
const sql = (tables = 150): string => `${'-- schema\nSET statement_timeout = 0;\n'}${Array.from({ length: tables }, (_, i) => `CREATE TABLE public.t${i} (id text NOT NULL, note text);\nALTER TABLE ONLY public.t${i} ADD CONSTRAINT t${i}_pkey PRIMARY KEY (id);\nALTER TABLE public.t${i} ENABLE ROW LEVEL SECURITY;\n`).join('')}`;
const FOLDERS = ['20260718152033_init', '20260722000000_web_push_subscriptions', '20261219200000_v3_wave2_index_name_63', 'migration_lock.toml'];

describe('the pieces', () => {
  it('step A dumps structure only, no owners, no grants, the public schema, without the migration history table', () => {
    const a = lib.dumpArgs();
    expect(a).toEqual(expect.arrayContaining(['--schema-only', '--no-owner', '--no-privileges', '--schema=public', '--exclude-table=public._prisma_migrations']));
    expect(a).not.toContain('--data-only'); expect(a.join(' ')).not.toMatch(/--clean|--create|--inserts/);
  });
  it('lists only real migration folders, oldest first, whatever order the disk gives; none at all is an error', () => {
    expect(lib.migrationFolders(['20261219200000_v3_wave2_index_name_63', 'migration_lock.toml', '20260718152033_init', 'notes.txt', '20260722000000_web_push_subscriptions'])).toEqual(['20260718152033_init', '20260722000000_web_push_subscriptions', '20261219200000_v3_wave2_index_name_63']);
    expect(() => lib.migrationFolders(['migration_lock.toml'])).toThrow();
    const real = fs.readdirSync(path.resolve(__dirname, '../prisma/migrations'));
    const list = lib.migrationFolders(real); expect(list.length).toBeGreaterThan(50); expect([...list].sort()).toEqual(list); expect(list).toContain('20261219200000_v3_wave2_index_name_63');
  });
  it('needs pgcrypto, uuid-ossp and pg_trgm, and creates only the ones that are missing', () => {
    expect(lib.REQUIRED_EXTENSIONS).toEqual(['pgcrypto', 'uuid-ossp', 'pg_trgm']);
    expect(lib.extensionsToCreate(['plpgsql', 'pgcrypto', 'uuid-ossp'])).toEqual(['pg_trgm']); expect(lib.extensionsToCreate([])).toEqual(['pgcrypto', 'uuid-ossp', 'pg_trgm']); expect(lib.extensionsToCreate(['pgcrypto', 'uuid-ossp', 'pg_trgm'])).toEqual([]);
    expect(fs.readFileSync(path.resolve(__dirname, '../prisma/migrations/20261107100000_v3_directory/migration.sql'), 'utf8')).toContain('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  });
  it('a database is empty only with no public table and no migration history table', () => {
    expect(lib.emptinessProblem({ publicTables: 0, hasMigrationsTable: false })).toBeNull();
    expect(lib.emptinessProblem({ publicTables: 1, hasMigrationsTable: false })).toMatch(/not empty/);
    expect(lib.emptinessProblem({ publicTables: 0, hasMigrationsTable: true })).toMatch(/not empty/);
    expect(lib.emptinessProblem({ publicTables: 151, hasMigrationsTable: true })).toMatch(/not empty/);
    expect(lib.emptinessProblem({ publicTables: undefined, hasMigrationsTable: false })).toMatch(/Could not count/);
  });
  it('step A takes the schema from the staging project only: not production, not any other', () => {
    const cfg = { allowedProjectRefHashes: ['stagingHash'], deniedProjectRefHashes: ['prodHash'] };
    expect(lib.sourceProblem('stagingHash', cfg)).toBeNull();
    expect(lib.sourceProblem('prodHash', cfg)).toMatch(/production/); expect(lib.sourceProblem('someOtherHash', cfg)).toMatch(/not the staging project/); expect(lib.sourceProblem(null, cfg)).toMatch(/Supabase/);
    const real = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../scripts/staging/staging-guard.config.json'), 'utf8'));
    expect(real.allowedProjectRefHashes.length).toBeGreaterThan(0);
  });
  it('the schema file must look like a full schema-only dump: no data, no drops, no roles, no other schema, no psql command; and never repeats its content', () => {
    expect(lib.sqlFileProblem(sql())).toBeNull(); expect(lib.sqlFileProblem(`${sql()}\n\\restrict abc\n\\unrestrict abc\nCREATE SCHEMA IF NOT EXISTS public;\n`)).toBeNull();
    for (const [extra, word] of [['DROP TABLE public.t1;', 'DROP'], ['TRUNCATE public.t1;', 'DROP'], ["INSERT INTO public.t1 VALUES ('SECRETROW');", 'data'], ['COPY public.t1 FROM stdin;', 'data'], ['DELETE FROM public.t1;', 'data'], ['CREATE ROLE evil;', 'role'], ['ALTER ROLE postgres PASSWORD \'x\';', 'role'], ['CREATE DATABASE other;', 'role'], ['\\connect other', 'psql'], ['CREATE SCHEMA other;', 'schema']]) {
      const r = lib.sqlFileProblem(`${sql()}\n${extra}\n`); expect([extra, r !== null]).toEqual([extra, true]); expect(r).not.toContain('SECRETROW'); void word;
    }
    expect(lib.sqlFileProblem(sql(10))).toMatch(/only 10 tables/); expect(lib.sqlFileProblem('')).toMatch(/missing or too small/); expect(lib.sqlFileProblem(undefined)).not.toBeNull();
  });
  it('the manifest ties step B to the file step A wrote, and to this checkout\'s migration count', () => {
    const t = sql(); const m = lib.manifestFor(t, 3);
    expect(m).toEqual({ tables: 150, migrations: 3, sha256: lib.sha256(t) });
    const f = ['a', 'b', 'c'];
    expect(lib.manifestProblem(m, t, f)).toBeNull();
    expect(lib.manifestProblem(m, `${t}-- changed\n`, f)).toMatch(/hash differs/); expect(lib.manifestProblem(m, t, ['a', 'b'])).toMatch(/migration folders/); expect(lib.manifestProblem(null, t, f)).toMatch(/missing/);
    expect(lib.manifestProblem({ ...m, tables: 149 }, t, f)).not.toBeNull();
  });
});

describe('runBaseline: the fixed order and the refusals', () => {
  const FOLD = ['20260718152033_init', '20260722000000_web_push_subscriptions', '20261219200000_v3_wave2_index_name_63'];
  function world(over: Partial<{ tables: number; migrationsTable: boolean; have: string[]; extSchema: boolean; failApply: boolean; failResolveAt: number; rlsOff: number; unexpected: string[]; tablesAfter: number }> = {}) {
    const log: string[] = []; const s = sql(); const manifest = lib.manifestFor(s, FOLD.length); let applied = false; let resolved = 0;
    const o = { tables: 0, migrationsTable: false, have: ['plpgsql', 'pgcrypto', 'uuid-ossp'], extSchema: true, failApply: false, failResolveAt: -1, rlsOff: 0, unexpected: [] as string[], tablesAfter: 150, ...over };
    const io: Io = {
      publicTables: async () => (applied ? o.tablesAfter : o.tables), hasMigrationsTable: async () => o.migrationsTable, extensionSchemaExists: async () => o.extSchema, extensionsPresent: async () => o.have,
      createExtension: async (n) => { log.push(`ext:${n}`); }, applySql: async () => { log.push('apply'); if (o.failApply) throw new Error('x'); applied = true; },
      resolveApplied: async (n) => { if (resolved === o.failResolveAt) throw new Error('x'); resolved += 1; log.push(`resolve:${n}`); }, rlsOffCount: async () => o.rlsOff, drift: async () => ({ allowed: ['a', 'b'], unexpected: o.unexpected }),
    };
    const said: string[] = []; const run = () => lib.runBaseline({ sqlText: s, manifest, folderNames: [...FOLD].reverse().concat('migration_lock.toml'), io, say: (x) => said.push(x) });
    return { log, said, run };
  }
  it('creates the missing extension, applies the schema once, marks every migration applied oldest first, then checks; prints counts only', async () => {
    const w = world(); const r = await w.run();
    expect(r.ok).toBe(true); expect(r.counts).toEqual({ extensionsCreated: 1, tables: 150, resolved: 3, rlsOff: 0, driftAllowed: 2, driftUnexpected: 0 });
    expect(w.log).toEqual(['ext:pg_trgm', 'apply', ...FOLD.map((f) => `resolve:${f}`)]);
    expect(w.said.join('\n')).toBe('Baseline done: 150 tables, 1 extension(s) created, 3 of 3 migrations marked applied, 0 tables without row level security, 2 documented drift item(s), 0 unexpected.');
  });
  it('REFUSES a database that is not empty, before any change (a table, a migration history table, or both)', async () => {
    for (const over of [{ tables: 1 }, { tables: 151 }, { migrationsTable: true }, { tables: 151, migrationsTable: true }]) {
      const w = world(over); const r = await w.run();
      expect([JSON.stringify(over), r.ok, r.step, w.log]).toEqual([JSON.stringify(over), false, 'database not empty', []]);
    }
  });
  it('refuses a bad schema file, a file that is not step A\'s, and a changed number of migration folders, before touching the database', async () => {
    const w = world(); const t = lib.manifestFor(sql(), FOLD.length);
    const calls: string[] = []; const io = { publicTables: async () => { calls.push('x'); return 0; } } as unknown as Io;
    expect((await lib.runBaseline({ sqlText: `${sql()}\nDROP TABLE public.t1;\n`, manifest: t, folderNames: FOLD, io })).step).toBe('schema file');
    expect((await lib.runBaseline({ sqlText: sql(), manifest: { ...t, sha256: 'bad' }, folderNames: FOLD, io })).step).toBe('manifest');
    expect((await lib.runBaseline({ sqlText: sql(), manifest: t, folderNames: FOLD.slice(1), io })).step).toBe('manifest');
    expect((await lib.runBaseline({ sqlText: sql(), manifest: t, folderNames: ['migration_lock.toml'], io })).step).toBe('migration folders');
    expect(calls).toEqual([]); void w;
  });
  it('stops at the first failure and says which: no extensions schema, failed apply (nothing marked), wrong table count, a failed mark, row level security off, unexpected drift', async () => {
    let w = world({ extSchema: false }); expect((await w.run()).step).toBe('extensions'); expect(w.log).toEqual([]);
    w = world({ failApply: true }); expect((await w.run()).step).toBe('apply schema'); expect(w.log).toEqual(['ext:pg_trgm', 'apply']);
    w = world({ tablesAfter: 149 }); expect((await w.run()).step).toBe('table count'); expect(w.log.filter((l) => l.startsWith('resolve'))).toEqual([]);
    w = world({ failResolveAt: 1 }); const r = await w.run(); expect(r.step).toBe('mark applied'); expect(w.log.filter((l) => l.startsWith('resolve'))).toEqual([`resolve:${FOLD[0]}`]); expect(r.why).toMatch(/new project/);
    w = world({ rlsOff: 2 }); expect((await w.run()).step).toBe('row level security');
    w = world({ unexpected: ['x'] }); expect((await w.run()).step).toBe('drift');
  });
  it('prints no table name, no statement and no connection (the messages hold counts and step names only)', async () => {
    const all: string[] = [];
    for (const over of [{}, { tables: 3 }, { failApply: true }, { tablesAfter: 1 }, { rlsOff: 1 }, { unexpected: ['DROP INDEX secretname'] }]) { const w = world(over); await w.run(); all.push(...w.said); }
    const text = all.join('\n'); expect(text).not.toMatch(/CREATE TABLE|public\.t\d|secretname|postgres(ql)?:\/\//);
  });
});

describe('the scripts', () => {
  const code = (f: string): string => fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8').split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('/*')).join('\n');
  it('step A takes no argument, asks for the connection string at a prompt that does not echo, accepts only the staging project, and checks staging is at the head with no unexpected drift before dumping', () => {
    const c = code('scripts/live/dump-staging-schema.js');
    expect(c).toContain('process.argv.length > 2'); expect(c).toContain('askSecret'); expect(c).toContain('sourceProblem'); expect(c).toContain("'migrate', 'status'"); expect(c).toContain('classifyDrift');
    expect(c).not.toMatch(/process\.env\.(DATABASE_URL|DIRECT_URL|STAGING)/); expect(c).not.toMatch(/console\.(log|error)\([^'"`)]*(url|text|errors)\b/i);
    expect(c.indexOf("'migrate', 'status'")).toBeLessThan(c.indexOf("spawn('pg_dump'"));
    expect(code('scripts/live/prompt.js')).toContain('muted');
  });
  it('step B refuses what is not the live database through the same guards as migrate-live, checks emptiness BEFORE asking for LIVE, and asks for LIVE before the first write', () => {
    const c = code('scripts/live/baseline-live.js');
    expect(c).toContain('liveSeedEnv(process.env, checkDatabaseUrls)'); expect(c).toContain('emptinessProblem'); expect(c).toContain('applyConfirmed');
    expect(c.indexOf('emptinessProblem(')).toBeLessThan(c.indexOf("ask('This writes"));
    expect(c.indexOf("ask('This writes")).toBeLessThan(c.indexOf('runBaseline({'));
    expect(c).toContain('--single-transaction'); expect(c).toContain('ON_ERROR_STOP=1'); expect(c).toContain("'migrate', 'resolve', '--applied'");
    expect(c).not.toMatch(/console\.(log|error)\([^'"`)]*(DIRECT_URL|DATABASE_URL|sqlText)/);
  });
  it('step B refuses a staging database, a missing step A, and an argument (run for real: no database is touched)', () => {
    const staging = 'postgresql://app:Pa55-w0rd-Zq81xv@db.staging.company.com:5432/postgres';
    const run = (args: string[], env: Record<string, string>) => spawnSync(process.execPath, [path.resolve(__dirname, '../scripts/live/baseline-live.js'), ...args], { env: { PATH: process.env.PATH ?? '', ...env }, encoding: 'utf8' });
    const a = run([], { DATABASE_URL: staging, DIRECT_URL: staging }); expect(a.status).toBe(3); expect(a.stderr + a.stdout).not.toMatch(/Pa55|staging\.company/);
    expect(run(['x'], {}).status).toBe(2);
    const live = 'postgresql://app:Pa55-w0rd-Zq81xv@db.livepr0jectref.supabase.co:5432/postgres';
    const b = run([], { DATABASE_URL: live, DIRECT_URL: live, BASELINE_DIR: path.resolve(__dirname, 'no-such-baseline-folder') }); expect(b.status).toBe(2); expect(b.stderr).toContain('step A has not been run');
  });
  it('the baseline folder is ignored by git, so the schema is never committed', () => {
    const ignore = fs.readFileSync(path.resolve(__dirname, '../../.gitignore'), 'utf8');
    expect(ignore).toMatch(/^backend-api\/live-baseline\/$/m);
  });
});
