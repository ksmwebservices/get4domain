import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';

/* eslint-disable @typescript-eslint/no-require-imports */
const lib = require('../scripts/bootstrap-super-admin-lib') as {
  bootstrapSuperAdmin: (d: { prisma: unknown; ask: (q: string) => Promise<string>; askSecret: (q: string) => Promise<string>; hash: (p: string) => Promise<string>; say?: (s: string) => void }) => Promise<{ ok: boolean; reason?: string }>;
  passwordProblem: (p: unknown, email?: string) => string | null;
};

/** Job L4: the one-time bootstrap of the first SUPER_ADMIN. */
const GOOD = 'Tr1cky-Horse-Battery!';
interface Row { id?: string; email: string; password: string; role: string; name: string; businessName: string }

function fakeDb(seed: { vendors?: Array<{ role: string; email?: string }>; staff?: Array<{ role: string; status: string }>; failCreateWith?: { code: string } } = {}) {
  const vendors: Array<{ role: string; email?: string }> = [...(seed.vendors ?? [])]; const staff = [...(seed.staff ?? [])]; const created: Row[] = [];
  let txOptions: unknown = null;
  const db = {
    vendor: {
      count: async ({ where }: { where: { role: { in: string[] } } }) => vendors.filter((v) => where.role.in.includes(v.role)).length,
      create: async ({ data }: { data: Row }) => { if (seed.failCreateWith) throw Object.assign(new Error('unique'), seed.failCreateWith); created.push(data); vendors.push({ role: data.role, email: data.email }); return data; },
    },
    adminTeamMember: { count: async ({ where }: { where: { role: string; status: { not: string } } }) => staff.filter((s) => s.role === where.role && s.status !== where.status.not).length },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>, options: unknown) => { txOptions = options; return fn(db); },
  };
  return { db, created, vendors, txOptions: () => txOptions };
}
const prompts = (answers: { email?: string[]; secrets?: string[] }) => {
  const asked: string[] = []; const e = [...(answers.email ?? [])]; const s = [...(answers.secrets ?? [])];
  return { asked, ask: async (q: string) => { asked.push(q); return e.shift() ?? ''; }, askSecret: async (q: string) => { asked.push(q); return s.shift() ?? ''; } };
};
const run = async (db: unknown, p: ReturnType<typeof prompts>) => { const said: string[] = []; const r = await lib.bootstrapSuperAdmin({ prisma: db, ask: p.ask, askSecret: p.askSecret, hash: (pw) => bcrypt.hash(pw, 4), say: (s) => said.push(s) }); return { r, said: said.join('\n') }; };

describe('creating the first SUPER_ADMIN', () => {
  it('asks for the email and the password (twice) and stores a vendor account with role SUPER_ADMIN whose password is only a bcrypt hash', async () => {
    const f = fakeDb(); const p = prompts({ email: ['  Owner@Vendors-Live.co.in '], secrets: [GOOD, GOOD] });
    const { r, said } = await run(f.db, p);
    expect(r).toEqual({ ok: true });
    expect(f.created).toHaveLength(1);
    expect(f.created[0]).toMatchObject({ email: 'owner@vendors-live.co.in', role: 'SUPER_ADMIN', name: 'Super Admin' });
    expect(f.created[0].password).not.toBe(GOOD); expect(await bcrypt.compare(GOOD, f.created[0].password)).toBe(true);
    expect(p.asked).toEqual(['Email address of the first SUPER_ADMIN: ', 'Password (not shown): ', 'Type the password again: ']);
    expect(said).toContain('was created');
    expect(f.txOptions()).toEqual({ isolationLevel: 'Serializable' });
  });
  it('never prints the password, its hash or the email', async () => {
    const f = fakeDb(); const { said } = await run(f.db, prompts({ email: ['owner@vendors-live.co.in'], secrets: [GOOD, GOOD] }));
    expect(said).not.toContain(GOOD); expect(said).not.toContain(f.created[0].password); expect(said).not.toContain('vendors-live');
    const bad = await run(fakeDb().db, prompts({ email: ['owner@vendors-live.co.in'], secrets: ['short', 'short', 'short'] }));
    expect(bad.said).not.toContain('short, '); expect(bad.said).not.toContain('vendors-live');
  });
  it('a second run refuses: nothing is asked and nothing is created', async () => {
    const f = fakeDb(); await run(f.db, prompts({ email: ['owner@vendors-live.co.in'], secrets: [GOOD, GOOD] }));
    const p = prompts({ email: ['another@vendors-live.co.in'], secrets: [GOOD, GOOD] });
    const { r, said } = await run(f.db, p);
    expect(r).toEqual({ ok: false, reason: 'EXISTS' }); expect(p.asked).toEqual([]); expect(f.created).toHaveLength(1); expect(said).toContain('already exists');
  });
  it('refuses when ANY administrator exists: a SUPER_ADMIN or ADMIN account, or an active SUPER_ADMIN staff member (a removed one does not count)', async () => {
    for (const seed of [{ vendors: [{ role: 'SUPER_ADMIN' }] }, { vendors: [{ role: 'ADMIN' }] }, { staff: [{ role: 'SUPER_ADMIN', status: 'active' }] }, { staff: [{ role: 'SUPER_ADMIN', status: 'invited' }] }]) {
      const f = fakeDb(seed); const p = prompts({ email: ['a@b.co'], secrets: [GOOD, GOOD] });
      expect([JSON.stringify(seed), (await run(f.db, p)).r.reason, p.asked.length, f.created.length]).toEqual([JSON.stringify(seed), 'EXISTS', 0, 0]);
    }
    const f = fakeDb({ vendors: [{ role: 'VENDOR' }], staff: [{ role: 'SUPER_ADMIN', status: 'removed' }, { role: 'OPERATIONS', status: 'active' }] });
    expect((await run(f.db, prompts({ email: ['owner@vendors-live.co.in'], secrets: [GOOD, GOOD] }))).r.ok).toBe(true);
  });
  it('an administrator made between the first check and the write is caught inside the transaction', async () => {
    const f = fakeDb(); let first = true; const original = f.db.vendor.count;
    f.db.vendor.count = async (a: { where: { role: { in: string[] } } }) => { if (first) { first = false; return 0; } return (await original(a)) + 1; };
    const { r } = await run(f.db, prompts({ email: ['owner@vendors-live.co.in'], secrets: [GOOD, GOOD] }));
    expect(r).toEqual({ ok: false, reason: 'EXISTS' }); expect(f.created).toHaveLength(0);
  });
  it('an email already used by another account is refused without creating anything', async () => {
    const f = fakeDb({ failCreateWith: { code: 'P2002' } });
    const { r } = await run(f.db, prompts({ email: ['owner@vendors-live.co.in'], secrets: [GOOD, GOOD] }));
    expect(r).toEqual({ ok: false, reason: 'EMAIL_TAKEN' });
  });
});

describe('the prompts', () => {
  it('an email that is not an address is asked again, three tries at most', async () => {
    const f = fakeDb(); const p = prompts({ email: ['nope', 'still nope', 'owner@vendors-live.co.in'], secrets: [GOOD, GOOD] });
    expect((await run(f.db, p)).r.ok).toBe(true);
    const g = fakeDb(); expect((await run(g.db, prompts({ email: ['a', 'b', 'c', 'owner@vendors-live.co.in'], secrets: [GOOD, GOOD] }))).r).toEqual({ ok: false, reason: 'INVALID_EMAIL' });
    expect(g.created).toHaveLength(0);
  });
  it('a password that is too short, simple, without a symbol or containing the email name is refused; one that is typed differently the second time is refused', async () => {
    for (const bad of ['Short1!', 'alllowercase1234!', 'ALLUPPERCASE1234!', 'NoDigitsHere!!!!', 'NoSymbolsHere1234', 'ownerowner-Owner1!', 'a'.repeat(73) + 'A1!']) expect([bad, lib.passwordProblem(bad, 'owner@x.co') !== null]).toEqual([bad, true]);
    expect(lib.passwordProblem(GOOD, 'owner@x.co')).toBeNull();
    const f = fakeDb(); const r = await run(f.db, prompts({ email: ['owner@vendors-live.co.in'], secrets: [GOOD, GOOD + 'x', GOOD, GOOD + 'y', GOOD, GOOD + 'z'] }));
    expect(r.r).toEqual({ ok: false, reason: 'MISMATCH' }); expect(f.created).toHaveLength(0);
    const g = fakeDb(); expect((await run(g.db, prompts({ email: ['owner@vendors-live.co.in'], secrets: ['weak', GOOD, GOOD] }))).r.ok).toBe(true);
  });
});

describe('the script itself', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../scripts/bootstrap-super-admin.js'), 'utf8');
  const code = src.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('/*')).join('\n');
  it('takes no arguments and needs a terminal; reads no file and no environment variable for the email or the password', () => {
    expect(code).toContain('process.argv.length > 2'); expect(code).toContain('isTTY');
    expect(code).not.toMatch(/readFile|createReadStream|fs\./);
    expect(code).not.toMatch(/process\.env\.(?!DIRECT_URL|DATABASE_URL)/);
    expect(code).not.toMatch(/process\.argv\[|process\.argv\.slice|process\.argv\.(find|map)/);
  });
  it('prints no password, uses a muted prompt for it, and refuses a staging or test database through the startup check', () => {
    expect(code).toContain('askSecret'); expect(code).toContain('muted');
    expect(code).toContain('checkDatabaseUrls');
    expect(code).not.toMatch(/console\.(log|error)\([^'"`)]*\b(password|hash|answer|pw)\b/i);   // no variable that holds a secret is ever printed (a sentence about "the password" is fine)
  });
  it('is shipped in the live image', () => { expect(fs.readFileSync(path.resolve(__dirname, '../Dockerfile.v3live'), 'utf8')).toMatch(/COPY .*\/app\/scripts \.\/scripts/); });
});
