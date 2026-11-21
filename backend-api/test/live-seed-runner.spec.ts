import * as fs from 'fs';
import * as path from 'path';
import { checkDatabaseUrls } from '../src/common/startup-check';

/* eslint-disable @typescript-eslint/no-require-imports */
const lib = require('../scripts/live/live-env-lib') as {
  liveSeedEnv: (e: Record<string, string | undefined>, c: typeof checkDatabaseUrls) => { ok: boolean; problems?: string[]; DATABASE_URL?: string; mask?: (t: string) => string };
  SEED_SCRIPTS: string[]; applyConfirmed: (t: unknown) => boolean;
};

/** Job L6: the runner that lets the data loaders write to the LIVE database, and only to it. */
const LIVE = 'postgresql://app:Pa55-w0rd-Zq81xv@db.livepr0jectref.supabase.co:5432/postgres';
describe('the live seed runner', () => {
  it('every seed-v3 loader is on the list (a new loader must be added on purpose), and every listed file exists', () => {
    const scripts = fs.readdirSync(path.resolve(__dirname, '../scripts')).filter((f) => /^seed-v3-.*\.js$/.test(f));
    expect(scripts.filter((f) => !lib.SEED_SCRIPTS.includes(f))).toEqual([]);
    for (const s of lib.SEED_SCRIPTS) expect([s, fs.existsSync(path.resolve(__dirname, '../scripts', s))]).toEqual([s, true]);
  });
  it('accepts a live connection and masks it, refuses a staging, test or local one and a missing one, and never repeats a value', () => {
    const ok = lib.liveSeedEnv({ DATABASE_URL: LIVE, DIRECT_URL: LIVE }, checkDatabaseUrls);
    expect(ok.ok).toBe(true); expect(ok.mask!(`failed for ${LIVE} Pa55-w0rd-Zq81xv`)).not.toMatch(/Pa55|livepr0jectref/);
    for (const bad of [{ DATABASE_URL: LIVE, DIRECT_URL: 'postgresql://app:Pa55-w0rd-Zq81xv@db.staging.company.com:5432/postgres' }, { DATABASE_URL: 'postgresql://app:Pa55-w0rd-Zq81xv@localhost:5432/postgres', DIRECT_URL: LIVE }, { DATABASE_URL: LIVE }, {}]) {
      const r = lib.liveSeedEnv(bad, checkDatabaseUrls); expect(r.ok).toBe(false); expect(JSON.stringify(r.problems)).not.toMatch(/Pa55|staging\.company|livepr0jectref/);
    }
  });
  it('only the word LIVE, typed exactly, confirms a write', () => {
    expect([lib.applyConfirmed('LIVE'), lib.applyConfirmed(' LIVE \n')]).toEqual([true, true]);
    for (const t of ['live', 'yes', 'y', '', 'LIVE!', undefined, null, 'STAGING']) expect([t, lib.applyConfirmed(t)]).toEqual([t, false]);
  });
  it('the script defaults to a dry run, needs a terminal and the confirmation for --apply, leaves the staging guard file alone, and never prints a connection', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../scripts/live/seed-live.js'), 'utf8');
    const code = src.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('/*')).join('\n');
    expect(code).toContain('isTTY'); expect(code).toContain('applyConfirmed'); expect(code).toContain('checkDatabaseUrls');
    expect(code.indexOf('applyConfirmed(')).toBeLessThan(code.indexOf('guard.loadStagingEnv ='));
    expect(code).not.toMatch(/console\.(log|error)\([^'"`)]*(DATABASE_URL|DIRECT_URL)/);
    expect(fs.readFileSync(path.resolve(__dirname, '../scripts/staging/guard.js'), 'utf8')).toContain('is not on the staging allow-list');   // the guard itself still refuses everything but staging
  });
});
