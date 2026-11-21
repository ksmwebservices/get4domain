import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

/** Job L6: the live migration door and the pre-flight check. */
const read = (f: string): string => fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8');
const codeOf = (src: string): string => src.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('/*')).join('\n');

describe('scripts/live/migrate-live.js', () => {
  const code = codeOf(read('scripts/live/migrate-live.js'));
  it('knows only status and deploy, refuses a staging, test or local database, and needs LIVE typed in a terminal for a deploy', () => {
    expect(code).toContain("['status', 'deploy', 'drift', 'rls'].includes(cmd)"); expect(code).toContain('checkDatabaseUrls'); expect(code).toContain('isTTY'); expect(code).toContain('applyConfirmed');
    expect(code.indexOf('applyConfirmed(')).toBeLessThan(code.indexOf('spawnSync(process'));
    expect(code).toContain("['prisma', 'migrate', cmd]"); expect(code).toContain("'migrate', 'diff', '--from-schema-datasource'"); expect(code).toContain('NOT rowsecurity'); expect(code).not.toMatch(/migrate['"],\s*['"]?(dev|reset|resolve)|--force|--accept-data-loss|db push/);
  });
  it('masks the connection in everything the Prisma CLI prints', () => { expect(code).toContain('live.mask(r.stdout'); expect(code).toContain('live.mask(r.stderr'); });
  it('refuses to run with a staging database, a bad command, or a missing connection (run for real: no database is touched)', () => {
    const run = (args: string[], env: Record<string, string>) => spawnSync(process.execPath, [path.resolve(__dirname, '../scripts/live/migrate-live.js'), ...args], { env: { PATH: process.env.PATH ?? '', ...env }, encoding: 'utf8' });
    const staging = 'postgresql://app:Pa55-w0rd-Zq81xv@db.staging.company.com:5432/postgres';
    const a = run(['status'], { DATABASE_URL: staging, DIRECT_URL: staging }); expect(a.status).toBe(3); expect(a.stderr).toContain('MIGRATE REFUSED'); expect(a.stderr + a.stdout).not.toMatch(/Pa55|staging\.company/);
    expect(run(['reset'], {}).status).toBe(2);
    expect(run(['status'], {}).status).toBe(3);
  });
});

describe('scripts/live/check-live-env.js', () => {
  it('exits 1 and names the faults (never a value) for an incomplete environment', () => {
    const r = spawnSync(process.execPath, [path.resolve(__dirname, '../scripts/live/check-live-env.js')], { env: { PATH: process.env.PATH ?? '', JWT_SECRET: 'CHANGE_ME', DATABASE_URL: 'postgresql://app:Pa55-w0rd-Zq81xv@localhost:5432/postgres' }, encoding: 'utf8' });
    expect(r.status).toBe(1); expect(r.stderr).toContain('JWT_SECRET is still a placeholder'); expect(r.stderr).toContain('V3_DOMAIN is missing'); expect(r.stderr).toContain('DATABASE_URL points at');
    expect(r.stderr + r.stdout).not.toMatch(/Pa55|localhost|CHANGE_ME/);
  });
});
