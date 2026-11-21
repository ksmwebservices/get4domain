import * as fs from 'fs';
import * as path from 'path';
import { STAGING_PROJECT_REF_HASHES, V2_PROJECT_REF_HASHES, assertLiveEnv, checkDatabaseUrls, checkLiveEnv, databaseUrlProblem, isLiveProcess, isPlaceholder, projectRefOf, REQUIRED_LIVE_ENV } from '../src/common/startup-check';
import { createHash } from 'crypto';

/** Job L3: the live API refuses to boot with a missing or placeholder variable or a staging or test database, and never prints a value. */
const SECRET_A = 'q7Vx2mLpR9sT4wYb8nCd3hKfJ6gZaE1u';
const SECRET_B = 'Hn5Pz8Xc2VbQ7rLw4TmY9sKd3JgFa6Ue';
const SECRET_C = 'Zk3Wd9Rm6TyP1xLq8VnC4bHs7JfGe2Ua';
const DB_POOL = 'postgresql://app.livepr0jectref:Pa55-w0rd-Zq81xv@aws-0-ap-south-1.pooler.example-host.net:6543/postgres';
const DB_DIRECT = 'postgresql://app:Pa55-w0rd-Zq81xv@db.livepr0jectref.supabase.co:5432/postgres';

const good = (): Record<string, string> => ({
  NODE_ENV: 'production', V3_LIVE: 'true', V3_DOMAIN: 'vendors-live.co.in', DATABASE_URL: DB_POOL.replace('example-host.net', 'supabase.com'), DIRECT_URL: DB_DIRECT,
  JWT_SECRET: SECRET_A, PLATFORM_SETTINGS_KEY: SECRET_B, REVALIDATE_SECRET: SECRET_C, SITE_BASE_DOMAIN: 'vendors-live.co.in', TRUSTED_PROXIES: '172.18.0.1,10.0.0.0/24',
  FRONTEND_URL: 'https://app.vendors-live.co.in', PUBLIC_APP_URL: 'https://vendors-live.co.in', PUBLIC_API_URL: 'https://api.vendors-live.co.in', SERVER_IP: '203.0.113.7',
});
const names = (e: Record<string, string | undefined>): string[] => checkLiveEnv(e).map((p) => p.name);

describe('checkLiveEnv', () => {
  it('a complete, real-looking environment has no problem', () => { expect(checkLiveEnv(good())).toEqual([]); });
  it('each required variable, when missing or blank, is named', () => {
    for (const n of REQUIRED_LIVE_ENV) {
      for (const v of [undefined, '', '   ']) { const e: Record<string, string | undefined> = { ...good(), [n]: v }; expect([n, names(e).includes(n)]).toEqual([n, true]); }
    }
  });
  it('a placeholder is refused for every required variable (CHANGE_ME, your-..., <...>, xxx, example hosts)', () => {
    expect(['CHANGE_ME', 'changeme', 'your-secret-here', '<jwt secret>', 'xxxxxxxx', 'replace-me', 'placeholder', 'password'].every(isPlaceholder)).toBe(true);
    for (const n of ['JWT_SECRET', 'PLATFORM_SETTINGS_KEY', 'REVALIDATE_SECRET', 'V3_DOMAIN', 'SITE_BASE_DOMAIN', 'TRUSTED_PROXIES', 'FRONTEND_URL', 'PUBLIC_APP_URL', 'PUBLIC_API_URL', 'SERVER_IP']) {
      expect([n, names({ ...good(), [n]: 'CHANGE_ME' }).includes(n)]).toEqual([n, true]);
    }
    expect(names({ ...good(), V3_DOMAIN: 'example.com' })).toContain('V3_DOMAIN');
    expect(names({ ...good(), V3_DOMAIN: 'shop.invalid' })).toContain('V3_DOMAIN');
  });
  it('a database password or host that is a placeholder is refused', () => {
    expect(names({ ...good(), DATABASE_URL: 'postgresql://app:CHANGE_ME@db.livepr0jectref.supabase.co:5432/postgres' })).toContain('DATABASE_URL');
    expect(names({ ...good(), DIRECT_URL: 'postgresql://app:Pa55-w0rd-Zq81xv@<host>:5432/postgres' })).toContain('DIRECT_URL');
  });
  it('a secret under 32 characters, or two secrets that are the same, is refused', () => {
    expect(names({ ...good(), JWT_SECRET: 'short-but-real-looking-1' })).toContain('JWT_SECRET');
    expect(names({ ...good(), REVALIDATE_SECRET: SECRET_A })).toContain('REVALIDATE_SECRET');
    expect(names({ ...good(), PLATFORM_SETTINGS_KEY: SECRET_A })).toContain('PLATFORM_SETTINGS_KEY');
  });
  it('the public addresses must be https and on V3_DOMAIN; SITE_BASE_DOMAIN must be V3_DOMAIN or under it; SERVER_IP an IPv4 address; TRUSTED_PROXIES valid', () => {
    expect(names({ ...good(), FRONTEND_URL: 'http://app.vendors-live.co.in' })).toContain('FRONTEND_URL');
    expect(names({ ...good(), PUBLIC_API_URL: 'https://api.someone-else.com' })).toContain('PUBLIC_API_URL');
    expect(names({ ...good(), PUBLIC_APP_URL: 'https://notvendors-live.co.in' })).toContain('PUBLIC_APP_URL');
    expect(names({ ...good(), SITE_BASE_DOMAIN: 'other-domain.in' })).toContain('SITE_BASE_DOMAIN');
    expect(names({ ...good(), SITE_BASE_DOMAIN: 'sites.vendors-live.co.in' })).toEqual([]);
    expect(names({ ...good(), SERVER_IP: 'not-an-ip' })).toContain('SERVER_IP');
    expect(names({ ...good(), TRUSTED_PROXIES: 'nonsense' })).toContain('TRUSTED_PROXIES');
    expect(names({ ...good(), TRUSTED_PROXIES: '172.18.0.1,nonsense' })).toContain('TRUSTED_PROXIES');
  });
  it('development switches are refused in production (OTP echo, throttling off, test mail mode)', () => {
    for (const [n, v] of [['OTP_DEV_ECHO', 'true'], ['THROTTLE_DISABLED', 'true'], ['EMAIL_MODE', 'test']] as const) expect([n, names({ ...good(), [n]: v }).includes(n)]).toEqual([n, true]);
    expect(names({ ...good(), OTP_DEV_ECHO: 'false' })).toEqual([]);
  });
  it('NO problem text contains a value: not a secret, a host, a project name or a domain', () => {
    const e = { ...good(), JWT_SECRET: 'short-secret-VALUE-1', DATABASE_URL: 'postgresql://app:Pa55-w0rd-Zq81xv@db.staging-host.supabase.co:5432/postgres', FRONTEND_URL: 'http://leaky.vendors-live.co.in', SERVER_IP: 'bad-ip-VALUE' };
    const text = JSON.stringify(checkLiveEnv(e));
    for (const s of ['short-secret-VALUE-1', 'Pa55-w0rd-Zq81xv', 'staging-host', 'leaky.vendors-live', 'bad-ip-VALUE', SECRET_B]) expect(text).not.toContain(s);
  });
});

describe('the database rules', () => {
  const host = (h: string): string => `postgresql://app:Pa55-w0rd-Zq81xv@${h}:5432/postgres`;
  it('a staging, test, development, local or private host is refused, whatever the provider', () => {
    for (const h of ['db.staging.company.com', 'staging-db.company.com', 'company-test.db.example.org', 'db.dev.company.com', 'localhost', '127.0.0.1', '10.0.4.5', '192.168.1.9', 'qa-db.company.com', 'sandbox.company.com']) expect([h, databaseUrlProblem(host(h)) !== null]).toEqual([h, true]);
  });
  it('a staging or test NAME in the user or the database is refused too', () => {
    expect(databaseUrlProblem('postgresql://app.stagingref:Pa55-w0rd-Zq81xv@aws-0.pooler.supabase.com:6543/postgres')).not.toBeNull();
    expect(databaseUrlProblem('postgresql://app:Pa55-w0rd-Zq81xv@db.livepr0jectref.supabase.co:5432/app_test')).not.toBeNull();
  });
  it('the staging project is refused by the hash of its ref (no name is kept), and the list equals the staging guard\'s', () => {
    const cfg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../scripts/staging/staging-guard.config.json'), 'utf8')) as { allowedProjectRefHashes: string[] };
    expect([...STAGING_PROJECT_REF_HASHES]).toEqual(cfg.allowedProjectRefHashes);
    const list = STAGING_PROJECT_REF_HASHES as string[]; const ref = 'zz9fakeprojectref'; list.push(createHash('sha256').update(ref).digest('hex'));
    try { expect(databaseUrlProblem(`postgresql://app:Pa55-w0rd-Zq81xv@db.${ref}.supabase.co:5432/postgres`)).toMatch(/staging database/); expect(projectRefOf(`postgresql://app.${ref}:x@h.supabase.com:6543/postgres`)).toBe(ref); } finally { list.pop(); }
    expect(databaseUrlProblem(DB_DIRECT)).toBeNull();
  });
  it('the Version 2 production project is refused by the hash of its ref, the list equals the guard\'s denied list, and a different ref is accepted', () => {
    const cfg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../scripts/staging/staging-guard.config.json'), 'utf8')) as { deniedProjectRefHashes: string[] };
    expect([...V2_PROJECT_REF_HASHES]).toEqual(cfg.deniedProjectRefHashes);
    const list = V2_PROJECT_REF_HASHES as string[]; const ref = 'zz8fakev2projectref'; list.push(createHash('sha256').update(ref).digest('hex'));
    try {
      expect(databaseUrlProblem(`postgresql://app:Pa55-w0rd-Zq81xv@db.${ref}.supabase.co:5432/postgres`)).toMatch(/Version 2 production/);
      expect(databaseUrlProblem(`postgresql://app.${ref}:Pa55-w0rd-Zq81xv@aws-0.pooler.supabase.com:6543/postgres`)).toMatch(/Version 2 production/);
      expect(checkDatabaseUrls({ DATABASE_URL: `postgresql://app.${ref}:Pa55-w0rd-Zq81xv@aws-0.pooler.supabase.com:6543/postgres`, DIRECT_URL: DB_DIRECT }).map((p) => p.name)).toEqual(['DATABASE_URL']);
    } finally { list.pop(); }
    expect(databaseUrlProblem(DB_DIRECT)).toBeNull();
  });
  it('the live scripts all take their database rules from checkDatabaseUrls, so the Version 2 and staging refusals reach every one', () => {
    for (const f of ['baseline-live.js', 'migrate-live.js', 'seed-live.js']) expect(fs.readFileSync(path.resolve(__dirname, '../scripts/live', f), 'utf8')).toContain('liveSeedEnv(process.env, checkDatabaseUrls)');
    expect(fs.readFileSync(path.resolve(__dirname, '../scripts/live/backup-live-db.js'), 'utf8')).toContain('checkDatabaseUrls(');
    expect(fs.readFileSync(path.resolve(__dirname, '../src/main.ts'), 'utf8')).toContain('assertLiveEnv');
  });
  it('a bad string, a non-postgres scheme or a missing password is refused, and checkDatabaseUrls names the variable', () => {
    expect(databaseUrlProblem('not a url')).not.toBeNull(); expect(databaseUrlProblem('mysql://u:p@db.live.co:3306/x')).not.toBeNull(); expect(databaseUrlProblem('postgresql://app@db.livepr0jectref.supabase.co/postgres')).not.toBeNull();
    expect(checkDatabaseUrls({ DATABASE_URL: DB_DIRECT }).map((p) => p.name)).toEqual(['DIRECT_URL']);
  });
});

describe('assertLiveEnv (what main.ts calls first)', () => {
  const run = (env: Record<string, string | undefined>) => { const out: string[] = []; let code: number | null = null; assertLiveEnv(env, ((c: number) => { code = c; throw new Error('exit'); }) as never, (s) => out.push(s)); return { out: out.join(''), code }; };
  it('does nothing outside the live process: production without V3_LIVE, staging, tests, a developer machine', () => {
    for (const env of [{ NODE_ENV: 'production' }, { NODE_ENV: 'test', V3_LIVE: 'true' }, { V3_LIVE: 'true' }, {}]) { expect(isLiveProcess(env)).toBe(false); expect(run(env)).toEqual({ out: '', code: null }); }
  });
  it('refuses to boot (exit 1) with a missing variable, names it and every other fault, and prints no value', () => {
    const e = { ...good(), JWT_SECRET: undefined as unknown as string, DIRECT_URL: 'postgresql://app:Pa55-w0rd-Zq81xv@db.staging.company.com:5432/postgres' };
    let r: { out: string; code: number | null } = { out: '', code: null };
    try { run(e); } catch { /* exit */ }
    const out: string[] = []; try { assertLiveEnv(e, ((c: number) => { r.code = c; throw new Error('exit'); }) as never, (s) => out.push(s)); } catch { /* exit */ }
    r = { out: out.join(''), code: r.code };
    expect(r.code).toBe(1); expect(r.out).toContain('JWT_SECRET is missing'); expect(r.out).toContain('DIRECT_URL points at a staging');
    expect(r.out).not.toContain('Pa55-w0rd'); expect(r.out).not.toContain('staging.company.com'); expect(r.out).not.toContain(SECRET_B);
  });
  it('lets a complete live environment boot', () => { expect(run(good())).toEqual({ out: '', code: null }); });
  it('main.ts calls it before anything is created', () => {
    const main = fs.readFileSync(path.resolve(__dirname, '../src/main.ts'), 'utf8');
    expect(main.indexOf('assertLiveEnv();')).toBeGreaterThan(0); expect(main.indexOf('assertLiveEnv();')).toBeLessThan(main.indexOf('NestFactory.create'));
  });
});
