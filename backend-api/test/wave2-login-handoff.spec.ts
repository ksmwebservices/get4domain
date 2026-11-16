import * as fs from 'fs';
import * as path from 'path';
import { HttpException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Account, AccountDirectory } from '../src/account-security/account-directory.service';
import { HANDOFF_ERROR_CODES } from '../src/account-security/handoff.errors';
import { LoginHandoffController } from '../src/account-security/login-handoff.controller';
import { LoginHandoffService } from '../src/account-security/login-handoff.service';
import { issued } from '../src/account-security/session.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { BUSINESS_ERROR_CODES } from '../src/v3-business/business.errors';

/** Wave 2, public site gap G2: a short-lived, one-time handoff of a signed-in vendor owner from the public site to the vendor app. */
jest.setTimeout(120_000);
const codeOf = async (p: Promise<unknown>): Promise<{ status: number; code?: string }> => { try { await p; } catch (e) { if (e instanceof HttpException) return { status: e.getStatus(), code: (e.getResponse() as { code?: string }).code }; throw e; } return { status: 0 }; };

interface Row { id: string; tokenHash: string; accountType: string; accountId: string; expiresAt: Date; usedAt: Date | null; issuedIp: string | null; createdAt: Date }
/** The two Prisma calls the service makes, in memory, with the same compare-and-set rule (a row is claimed only while unused and unexpired). */
function memoryPrisma() {
  const rows: Row[] = []; let n = 0;
  const handoff = {
    findUnique: async ({ where }: { where: { tokenHash: string } }) => rows.find((r) => r.tokenHash === where.tokenHash) ?? null,
    updateMany: async ({ where, data }: { where: { id?: string; accountType?: string; accountId?: string; usedAt: null; expiresAt?: { gt: Date } }; data: { usedAt: Date } }) => {
      const hit = rows.filter((r) => r.usedAt === null && (!where.id || r.id === where.id) && (!where.accountType || r.accountType === where.accountType) && (!where.accountId || r.accountId === where.accountId) && (!where.expiresAt || r.expiresAt > where.expiresAt.gt));
      for (const r of hit) r.usedAt = data.usedAt; return { count: hit.length };
    },
    create: async ({ data }: { data: Omit<Row, 'id' | 'usedAt' | 'createdAt'> }) => { const r: Row = { ...data, id: `h${++n}`, usedAt: null, createdAt: new Date() }; rows.push(r); return r; },
  };
  return { rows, prisma: { v3LoginHandoff: handoff, $transaction: async (ops: Array<Promise<unknown>>) => Promise.all(ops) } };
}

function build() {
  const m = memoryPrisma(); const accounts = new Map<string, Account>([['v1', { type: 'VENDOR', id: 'v1', email: 'owner@example.com', name: 'Owner', vendorId: 'v1', role: 'VENDOR' }]]);
  const directory = new AccountDirectory({} as never); directory.load = async (ref) => (ref.type === 'VENDOR' ? accounts.get(ref.id) ?? null : null);
  const minted: string[] = [];
  const sessions = { issue: async (a: Account) => { minted.push(a.id); return issued({ accessToken: `at-${a.id}`, refreshToken: `rt_${'x'.repeat(43)}` }); } };
  const svc = new LoginHandoffService(m.prisma as never, directory, sessions as never); let now = new Date('2026-11-16T10:00:00Z'); svc.clock = () => now;
  return { ...m, accounts, svc, minted, advance: (s: number) => { now = new Date(now.getTime() + s * 1000); } };
}
const owner = { sub: 'v1', email: 'owner@example.com', role: 'VENDOR' } as never;

describe('issue', () => {
  it('a vendor owner gets a code that lives 60 seconds by default; only its hash is stored', async () => {
    const t = build(); const r = await t.svc.issue(owner, '203.0.113.9');
    expect(r.code).toMatch(/^ho_[A-Za-z0-9_-]{43}$/); expect(r.ttlSeconds).toBe(60); expect(r.expiresAt).toBe('2026-11-16T10:01:00.000Z');
    expect(t.rows).toHaveLength(1); expect(JSON.stringify(t.rows)).not.toContain(r.code); expect(t.rows[0]).toMatchObject({ accountType: 'VENDOR', accountId: 'v1', usedAt: null, issuedIp: '203.0.113.9' });
  });
  it('the life follows LOGIN_HANDOFF_TTL_SECONDS, clamped to 15 to 300', async () => {
    const was = process.env.LOGIN_HANDOFF_TTL_SECONDS;
    try {
      for (const [v, want] of [['5', 15], ['120', 120], ['9999', 300], ['abc', 60], ['', 60]] as const) { process.env.LOGIN_HANDOFF_TTL_SECONDS = v; expect([v, (await build().svc.issue(owner, null)).ttlSeconds]).toEqual([v, want]); }
    } finally { if (was === undefined) delete process.env.LOGIN_HANDOFF_TTL_SECONDS; else process.env.LOGIN_HANDOFF_TTL_SECONDS = was; }
  });
  it('a team member, a staff member, a sandbox session and a removed account are refused with HANDOFF_NOT_ALLOWED', async () => {
    const t = build();
    for (const u of [{ sub: 'v1', kind: 'team_member', memberId: 'm1' }, { sub: 'a1', kind: 'admin_member' }, { sub: 'v1', kind: 'sandbox' }, { sub: 'gone', role: 'VENDOR' }]) expect(await codeOf(t.svc.issue(u as never, null))).toEqual({ status: 403, code: 'HANDOFF_NOT_ALLOWED' });
    expect(t.rows).toEqual([]);
  });
  it('asking again ends every older unused code (the rows stay as history)', async () => {
    const t = build(); const a = await t.svc.issue(owner, null); const b = await t.svc.issue(owner, null);
    expect(await codeOf(t.svc.redeem(a.code))).toEqual({ status: 401, code: 'HANDOFF_INVALID' }); await expect(t.svc.redeem(b.code)).resolves.toMatchObject({ accessToken: 'at-v1' }); expect(t.rows).toHaveLength(2);
  });
});

describe('redeem', () => {
  it('swaps the code for a session, once', async () => {
    const t = build(); const { code } = await t.svc.issue(owner, null);
    await expect(t.svc.redeem(code, 'jest')).resolves.toMatchObject({ accessToken: 'at-v1', refreshToken: expect.stringMatching(/^rt_/) }); expect(t.minted).toEqual(['v1']);
    expect(await codeOf(t.svc.redeem(code))).toEqual({ status: 401, code: 'HANDOFF_INVALID' }); expect(t.minted).toEqual(['v1']);
  });
  it('two simultaneous uses of one code give exactly one session', async () => {
    const t = build(); const { code } = await t.svc.issue(owner, null);
    const r = await Promise.all([codeOf(t.svc.redeem(code)), codeOf(t.svc.redeem(code)), codeOf(t.svc.redeem(code))]);
    expect(r.filter((x) => x.status === 0)).toHaveLength(1); expect(r.filter((x) => x.code === 'HANDOFF_INVALID')).toHaveLength(2); expect(t.minted).toHaveLength(1);
  });
  it('a code is dead at its expiry second and after', async () => {
    const t = build(); const a = await t.svc.issue(owner, null); t.advance(59); await expect(t.svc.redeem(a.code)).resolves.toBeDefined();
    const b = await t.svc.issue(owner, null); t.advance(60); expect(await codeOf(t.svc.redeem(b.code))).toEqual({ status: 401, code: 'HANDOFF_INVALID' });
  });
  it('every failure is the same 401: unknown, malformed, empty, another kind of token, used, expired, and an account suspended since', async () => {
    const t = build(); const used = await t.svc.issue(owner, null); await t.svc.redeem(used.code);
    const gone = await t.svc.issue(owner, null); t.accounts.delete('v1');
    for (const c of ['ho_' + 'A'.repeat(43), 'ho_short', '', 'rt_' + 'A'.repeat(43), used.code, gone.code, 5 as never, null as never]) expect([String(c).slice(0, 12), await codeOf(t.svc.redeem(c))]).toEqual([String(c).slice(0, 12), { status: 401, code: 'HANDOFF_INVALID' }]);
  });
  it('a code made for one owner never signs in another', async () => {
    const t = build(); t.accounts.set('v2', { type: 'VENDOR', id: 'v2', email: 'b@example.com', name: 'B', vendorId: 'v2', role: 'VENDOR' });
    const { code } = await t.svc.issue(owner, null); await t.svc.redeem(code); expect(t.minted).toEqual(['v1']);
  });
});

describe('registration and the migration', () => {
  it('both codes are registered with the exception filter', () => { expect(BUSINESS_ERROR_CODES).toEqual(expect.arrayContaining([...HANDOFF_ERROR_CODES])); });
  it('the migration is one additive table, with row level security and the checks', () => {
    const sql = fs.readFileSync(path.resolve(__dirname, '..', 'prisma/migrations/20261219190000_v3_wave2_login_handoff/migration.sql'), 'utf8');
    expect(sql).toContain('CREATE TABLE "g4d_login_handoffs"'); expect(sql).toContain('ENABLE ROW LEVEL SECURITY'); expect(sql).toContain('g4d_login_handoffs_owner_only_check'); expect(sql).toContain('g4d_login_handoffs_life_check');
    expect(sql).toContain('"tokenHash"'); expect(sql).not.toMatch(/DROP |DELETE FROM|ALTER TABLE "(?!g4d_login_handoffs)/);
  });
});

describe('over HTTP', () => {
  let app: INestApplication; let t: ReturnType<typeof build>;
  beforeEach(async () => {
    t = build();
    const mod = await Test.createTestingModule({ imports: [throttlerImport], controllers: [LoginHandoffController], providers: [throttlerGuardProvider, { provide: LoginHandoffService, useValue: t.svc }] }).compile();
    app = mod.createNestApplication();
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => { if (req.headers['x-test-owner']) req.user = { sub: 'v1', email: 'owner@example.com', role: 'VENDOR' }; next(); });
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter()); await app.init();
  });
  afterEach(async () => { await app.close(); });
  it('the owner asks, the vendor app swaps the code for tokens with no sign-in; the refresh token reaches the caller on this route only', async () => {
    const a = await request(app.getHttpServer()).post('/v3/auth/handoff').set({ 'x-test-owner': '1' }).send({});
    expect(a.status).toBe(200); expect(a.body.data).toMatchObject({ ttlSeconds: 60 }); const code = a.body.data.code as string;
    const b = await request(app.getHttpServer()).post('/v3/auth/handoff/redeem').send({ code });
    expect(b.status).toBe(200); expect(b.body.data).toMatchObject({ accessToken: 'at-v1' }); expect(String(b.body.data.refreshToken)).toMatch(/^rt_/);
    const again = await request(app.getHttpServer()).post('/v3/auth/handoff/redeem').send({ code }); expect(again.status).toBe(401); expect(JSON.stringify(again.body)).toContain('HANDOFF_INVALID');
  });
  it('a bad body is 400, and the redeem route is rate limited like a login', async () => {
    expect((await request(app.getHttpServer()).post('/v3/auth/handoff/redeem').send({})).status).toBe(401);
    const codes: number[] = []; for (let i = 0; i < 14; i++) codes.push((await request(app.getHttpServer()).post('/v3/auth/handoff/redeem').send({ code: 'ho_' + 'B'.repeat(43) })).status);
    expect(codes).toContain(429);
  });
  it('any malformed code (wrong prefix, short, long, missing, not text) is the same 401 HANDOFF_INVALID, never a 400, and the answers are identical', async () => {
    const bodies: object[] = [{ code: 'ho_short' }, { code: 'x' }, { code: '' }, { code: 'rt_' + 'A'.repeat(43) }, { code: 'ho_' + 'A'.repeat(500) }, { code: 'A'.repeat(1000) }, { code: 5 }, { code: null }, { code: { a: 1 } }, {}];
    const seen = new Set<string>();
    for (const b of bodies) { const r = await request(app.getHttpServer()).post('/v3/auth/handoff/redeem').send(b); expect([JSON.stringify(b).slice(0, 30), r.status, r.body.code]).toEqual([JSON.stringify(b).slice(0, 30), 401, 'HANDOFF_INVALID']); seen.add(r.body.message); }
    expect(seen.size).toBe(1);
  });
});
