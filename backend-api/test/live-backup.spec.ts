import * as fs from 'fs';
import * as path from 'path';

/* eslint-disable @typescript-eslint/no-require-imports */
const lib = require('../scripts/live/backup-lib') as {
  pgEnvFromUrl: (u: string) => Record<string, string>; backupFileName: (d: Date) => string; selectExpired: (n: string[], k: number) => string[]; keepFrom: (v?: string) => number;
  passphraseProblem: (t: unknown) => string | null; maskerFor: (e: Record<string, string>) => (t: string) => string; NAME_RE: RegExp;
};

/** Job L5: the pure parts of the live database backup. (pg_dump and openssl themselves are run by the owner on the server.) */
describe('the connection', () => {
  it('becomes PG* variables, decoded, with TLS required, so no password is in a command line', () => {
    const e = lib.pgEnvFromUrl('postgresql://app.ref:p%40ss%2Fw0rd@db.example-live.net:6543/livedb');
    expect(e).toEqual({ PGHOST: 'db.example-live.net', PGPORT: '6543', PGUSER: 'app.ref', PGPASSWORD: 'p@ss/w0rd', PGDATABASE: 'livedb', PGSSLMODE: 'require' });
    expect(lib.pgEnvFromUrl('postgresql://u:p@h.example-live.net/postgres').PGPORT).toBe('5432');
  });
  it('sslmode=disable is accepted for a container name or a private address', () => {
    for (const host of ['postgres-v3db-1', '172.18.0.5', '172.31.1.1', '10.0.0.4', '192.168.1.9', 'localhost']) {
      expect(lib.pgEnvFromUrl(`postgresql://u:p@${host}:5432/livedb?sslmode=disable`).PGSSLMODE).toBe('disable');
    }
  });
  it('sslmode=disable is refused for a public host, without repeating the URL', () => {
    for (const host of ['db.example-live.net', '8.8.8.8', '172.32.0.1', '172.15.0.1']) {
      expect(() => lib.pgEnvFromUrl(`postgresql://u:SecretPw1@${host}:5432/livedb?sslmode=disable`)).toThrow(/public/);
    }
    expect(() => lib.pgEnvFromUrl('postgresql://u:SecretPw1@db.example-live.net/x?sslmode=prefer')).toThrow(/^(?!.*SecretPw1)/);
  });
  it('no sslmode still requires TLS on every host; require and verify-full are honoured on a public host', () => {
    expect(lib.pgEnvFromUrl('postgresql://u:p@db.example-live.net/x').PGSSLMODE).toBe('require');
    expect(lib.pgEnvFromUrl('postgresql://u:p@postgres-v3db-1/x').PGSSLMODE).toBe('require');
    expect(lib.pgEnvFromUrl('postgresql://u:p@db.example-live.net/x?sslmode=verify-full').PGSSLMODE).toBe('verify-full');
  });
  it('a masker removes the password, user and host from any text', () => {
    const e = lib.pgEnvFromUrl('postgresql://app.ref:Sup3rSecretPw@db.example-live.net:5432/postgres');
    const out = lib.maskerFor(e)('connection to server at "db.example-live.net" failed for user "app.ref": password Sup3rSecretPw');
    for (const s of ['db.example-live.net', 'app.ref', 'Sup3rSecretPw']) expect(out).not.toContain(s);
  });
});

describe('the file name and the rotation', () => {
  it('names a backup by its UTC time, so names sort by time', () => {
    expect(lib.backupFileName(new Date('2026-11-20T03:15:09Z'))).toBe('v3live-20261120-031509Z.dump.enc');
    expect(lib.backupFileName(new Date('2026-11-20T03:15:09Z'))).toMatch(lib.NAME_RE);
    expect(lib.backupFileName(new Date('2026-01-02T00:00:00Z')) < lib.backupFileName(new Date('2026-11-02T00:00:00Z'))).toBe(true);
  });
  it('keeps the newest N and lists only the older ones of OUR files; anything else in the folder is never listed', () => {
    const names = ['v3live-20261101-000000Z.dump.enc', 'v3live-20261103-000000Z.dump.enc', 'v3live-20261102-000000Z.dump.enc', 'notes.txt', 'v3live-20261104-000000Z.dump.enc.partial', 'other.dump.enc', 'v3live-20261105-000000Z.dump.enc'];
    expect(lib.selectExpired(names, 2)).toEqual(['v3live-20261102-000000Z.dump.enc', 'v3live-20261101-000000Z.dump.enc']);
    expect(lib.selectExpired(names, 10)).toEqual([]);
    expect(lib.selectExpired(names, 0)).toEqual([]);   // an invalid count falls back to the default (14), never to "keep none"
    expect(lib.selectExpired(names, Number.NaN)).toEqual([]);
  });
  it('BACKUP_KEEP is a whole number from 1 to 3650, else 14', () => {
    expect([lib.keepFrom(undefined), lib.keepFrom(''), lib.keepFrom('7'), lib.keepFrom('0'), lib.keepFrom('-3'), lib.keepFrom('abc'), lib.keepFrom('1.5'), lib.keepFrom('99999')]).toEqual([14, 14, 7, 14, 14, 14, 14, 14]);
  });
});

describe('the passphrase', () => {
  it('must be at least 20 characters, and the message never repeats it', () => {
    expect(lib.passphraseProblem('short')).not.toBeNull(); expect(lib.passphraseProblem('   ' + 'x'.repeat(10) + '   ')).not.toBeNull(); expect(lib.passphraseProblem(undefined)).not.toBeNull();
    expect(lib.passphraseProblem('a-long-enough-passphrase-1234\n')).toBeNull();
    expect(lib.passphraseProblem('shortsecret')).not.toContain('shortsecret');
  });
});

describe('the script', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../scripts/live/backup-live-db.js'), 'utf8');
  const code = src.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('/*')).join('\n');
  it('encrypts the dump in a pipe (no plain copy on disk), checks it by reading it back, and only then renames it into place', () => {
    expect(code).toContain("'pg_dump'"); expect(code).toContain('aes-256-cbc'); expect(code).toContain('-pbkdf2');
    expect(code).toMatch(/dump\.stdout\.pipe\(crypt\.stdin\)/); expect(code).toContain("'pg_restore', ['--list']");
    expect(code.indexOf("'pg_restore', ['--list']")).toBeLessThan(code.indexOf('fs.renameSync(partial, final)'));
    expect(code).not.toMatch(/\.sql['"`]/);
  });
  it('refuses a staging or test database, a backup folder inside the repository, a weak or loosely guarded passphrase file; never puts the password on a command line', () => {
    expect(code).toContain('checkDatabaseUrls'); expect(code).toContain('must be outside the repository'); expect(code).toContain('passphraseProblem'); expect(code).toContain('0o077');
    expect(code).not.toMatch(/spawn\('pg_dump', \[[^\]]*(postgres|DIRECT_URL|PGPASSWORD)/);
    expect(code).not.toMatch(/console\.(log|error)\([^'"`)]*(DIRECT_URL|PGPASSWORD|passphrase)/i);
  });
});
