import { HttpException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { Account } from '../src/account-security/account-directory.service';
import { PasswordService } from '../src/account-security/password.service';
import { PublicPasswordResetController } from '../src/account-security/public-password-reset.controller';
import { PublicPasswordResetService, RESET_REPLY } from '../src/account-security/public-password-reset.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';

/** Wave 2, public site gap G14: password reset by email for the public site (request and confirm), flag OFF, no account enumeration. */
jest.setTimeout(120_000);
const codeOf = async (p: Promise<unknown>): Promise<{ status: number; code?: string }> => { try { await p; } catch (e) { if (e instanceof HttpException) return { status: e.getStatus(), code: (e.getResponse() as { code?: string }).code }; throw e; } return { status: 0 }; };

interface ResetRow { id: string; accountType: string; accountId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null; revokedAt: Date | null; requestedIp: string | null; createdAt: Date }
function build(o: { mail?: boolean; publicUrl?: string | null; sendFails?: boolean } = {}) {
  const rows: ResetRow[] = []; let n = 0; const passwords = new Map<string, string>([['v1', 'old']]);
  const matches = (r: ResetRow, w: Record<string, unknown>): boolean => Object.entries(w).every(([k, v]) => {
    if (k === 'createdAt') return r.createdAt >= (v as { gte: Date }).gte; if (k === 'expiresAt') return r.expiresAt > (v as { gt: Date }).gt;
    return (r as unknown as Record<string, unknown>)[k] === v;
  });
  const model = {
    count: async ({ where }: { where: Record<string, unknown> }) => rows.filter((r) => matches(r, where)).length,
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<ResetRow> }) => { const hit = rows.filter((r) => matches(r, where)); for (const r of hit) Object.assign(r, data); return { count: hit.length }; },
    create: async ({ data }: { data: Omit<ResetRow, 'id' | 'usedAt' | 'revokedAt' | 'createdAt'> }) => { const r: ResetRow = { ...data, id: `r${++n}`, usedAt: null, revokedAt: null, createdAt: new Date() }; rows.push(r); return r; },
    findUnique: async ({ where }: { where: { tokenHash: string } }) => rows.find((r) => r.tokenHash === where.tokenHash) ?? null,
  };
  const tx = { accountPasswordReset: model };
  const prisma = { accountPasswordReset: model, $transaction: async (a: unknown) => (Array.isArray(a) ? Promise.all(a) : (a as (t: unknown) => Promise<unknown>)(tx)) };
  const accounts = new Map<string, Account>([['owner@example.com', { type: 'VENDOR', id: 'v1', email: 'owner@example.com', name: 'Owner', vendorId: 'v1', role: 'VENDOR' }]]);
  const directory = { findByEmail: async (e: string) => accounts.get(e.trim().toLowerCase()) ?? null, load: async (ref: { id: string }) => [...accounts.values()].find((a) => a.id === ref.id) ?? null, setPassword: async (_t: unknown, ref: { id: string }, hash: string) => { passwords.set(ref.id, hash); } };
  const revoked: string[] = []; const sessions = { revokeAll: async (ref: { id: string }) => { revoked.push(ref.id); }, issue: async () => ({}) };
  const legacy = { sendPasswordReset: jest.fn(async () => undefined), sendPasswordChangedNotice: jest.fn(async () => undefined) };
  const svc = new PasswordService(prisma as never, directory as never, sessions as never, legacy as never);
  const sent: Array<{ lane: string; kind: string; to: string; subject: string; text: string }> = [];
  const email = { send: async (m: { lane: string; kind: string; to: string; subject: string; text: string }) => { if (o.sendFails) throw new Error('lane is off'); sent.push(m); } };
  const flag = { on: o.mail !== false };
  const pub = new PublicPasswordResetService(svc, email as never, () => flag.on, o.publicUrl === null ? undefined : async () => o.publicUrl ?? 'https://www.get4domain.com');
  return { rows, passwords, revoked, legacy, sent, flag, svc, pub, accounts };
}
const tokenOf = (text: string): string => /token=([A-Za-z0-9_-]+)/.exec(text)![1];

describe('request', () => {
  it('emails the reset link to the PUBLIC site through the mail port (system lane, kind ACCOUNT_NOTICE); the legacy mailer and FRONTEND_URL are not used', async () => {
    const t = build(); expect(t.pub.request('Owner@Example.com ', '203.0.113.9')).toEqual({ message: RESET_REPLY }); await t.svc.idle();
    expect(t.sent).toHaveLength(1); expect(t.sent[0]).toMatchObject({ lane: 'SYSTEM', kind: 'ACCOUNT_NOTICE', to: 'owner@example.com', subject: 'Reset your Get4Domain password' });
    expect(t.sent[0].text).toMatch(/https:\/\/get4domain\.com\/account\/reset-password\?token=[A-Za-z0-9_-]{43}/); expect(t.sent[0].text).not.toMatch(/www\./); expect(t.legacy.sendPasswordReset).not.toHaveBeenCalled();
    expect(t.rows).toHaveLength(1); expect(t.rows[0]).toMatchObject({ accountType: 'VENDOR', accountId: 'v1', requestedIp: '203.0.113.9' }); expect(JSON.stringify(t.rows)).not.toContain(tokenOf(t.sent[0].text));
  });
  it('NO account enumeration: an unknown email gets the same answer, the same status, and nothing is stored or sent', async () => {
    const t = build(); const known = t.pub.request('owner@example.com', null); const unknown = t.pub.request('nobody@example.com', null); await t.svc.idle();
    expect(unknown).toEqual(known); expect(t.sent.map((s) => s.to)).toEqual(['owner@example.com']); expect(t.rows).toHaveLength(1);
  });
  it('the answer does not wait for the lookup or the mail: a failing mail lane changes nothing the caller sees', async () => {
    const t = build({ sendFails: true }); expect(t.pub.request('owner@example.com', null)).toEqual({ message: RESET_REPLY }); await t.svc.idle(); expect(t.sent).toEqual([]);
  });
  it('with the mail switch OFF the request is 503 MAIL_DISABLED for a known and an unknown email alike, and nothing is looked up, stored or sent', async () => {
    const t = build({ mail: false });
    for (const e of ['owner@example.com', 'nobody@example.com']) expect(await codeOf((async () => t.pub.request(e, null))())).toEqual({ status: 503, code: 'MAIL_DISABLED' });
    await t.svc.idle(); expect(t.rows).toEqual([]); expect(t.sent).toEqual([]);
  });
  it('with no public address set, nothing is sent (no link can be built), and the answer is still the same', async () => {
    const t = build({ publicUrl: null }); expect(t.pub.request('owner@example.com', null)).toEqual({ message: RESET_REPLY }); await t.svc.idle(); expect(t.sent).toEqual([]);
    const bad = build({ publicUrl: 'not a url' }); bad.pub.request('owner@example.com', null); await bad.svc.idle(); expect(bad.sent).toEqual([]);
  });
  it('the existing cap holds: a fourth request in the hour sends nothing and looks the same; a new request voids the older link', async () => {
    const t = build(); for (let i = 0; i < 4; i++) { t.pub.request('owner@example.com', null); await t.svc.idle(); }
    expect(t.sent).toHaveLength(3); const [first, , third] = t.sent.map((s) => tokenOf(s.text));
    expect(t.rows.filter((r) => !r.revokedAt && !r.usedAt)).toHaveLength(1); await expect(t.pub.confirm(first, 'NewPassw0rd')).rejects.toBeInstanceOf(HttpException); void third;
  });
});

describe('confirm', () => {
  it('sets the new password with the emailed token, once; every session ends; the old link and the used token are one 400', async () => {
    const t = build(); t.pub.request('owner@example.com', null); await t.svc.idle(); const token = tokenOf(t.sent[0].text);
    await expect(t.pub.confirm(token, 'NewPassw0rd')).resolves.toEqual({ ok: true });
    expect(await bcrypt.compare('NewPassw0rd', t.passwords.get('v1')!)).toBe(true); expect(t.revoked).toEqual(['v1']); expect(t.legacy.sendPasswordChangedNotice).toHaveBeenCalledTimes(1);
    expect(await codeOf(t.pub.confirm(token, 'Another1Pass'))).toMatchObject({ status: 400 }); expect(await bcrypt.compare('NewPassw0rd', t.passwords.get('v1')!)).toBe(true);
  });
  it('a made-up, short or expired token is the same 400, and nothing changes', async () => {
    const t = build(); t.pub.request('owner@example.com', null); await t.svc.idle(); t.rows[0].expiresAt = new Date(Date.now() - 1000);
    for (const tk of ['A'.repeat(43), 'short', tokenOf(t.sent[0].text)]) expect(await codeOf(t.pub.confirm(tk, 'NewPassw0rd'))).toMatchObject({ status: 400 });
    expect(t.passwords.get('v1')).toBe('old');
  });
  it('confirm works with the mail switch OFF (a link sent earlier still works)', async () => {
    const t = build(); t.pub.request('owner@example.com', null); await t.svc.idle(); t.flag.on = false;
    await expect(t.pub.confirm(tokenOf(t.sent[0].text), 'NewPassw0rd')).resolves.toEqual({ ok: true });
  });
});

describe('over HTTP', () => {
  let app: INestApplication; let t: ReturnType<typeof build>;
  beforeEach(async () => {
    t = build();
    const mod = await Test.createTestingModule({ imports: [throttlerImport], controllers: [PublicPasswordResetController], providers: [throttlerGuardProvider, { provide: PublicPasswordResetService, useValue: t.pub }] }).compile();
    app = mod.createNestApplication(); app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter()); await app.init();
  });
  afterEach(async () => { await app.close(); });
  it('request is public and answers the same 200 for a known and an unknown address; email off is 503 with its code', async () => {
    const a = await request(app.getHttpServer()).post('/v3/account/password/reset/request').send({ email: 'owner@example.com' });
    const b = await request(app.getHttpServer()).post('/v3/account/password/reset/request').send({ email: 'nobody@example.com' });
    expect([a.status, b.status]).toEqual([200, 200]); expect(a.body.data).toEqual(b.body.data); await t.svc.idle();
    t.flag.on = false; const off = await request(app.getHttpServer()).post('/v3/account/password/reset/request').send({ email: 'owner@example.com' }); expect(off.status).toBe(503); expect(JSON.stringify(off.body)).toContain('MAIL_DISABLED');
  });
  it('a bad email is 400', async () => {
    expect((await request(app.getHttpServer()).post('/v3/account/password/reset/request').send({ email: 'nope' })).status).toBe(400);
  });
  it('confirm checks the password rule and answers ok with the real token; request is limited to three a minute', async () => {
    t.pub.request('owner@example.com', null); await t.svc.idle(); const token = tokenOf(t.sent[0].text);
    expect((await request(app.getHttpServer()).post('/v3/account/password/reset/confirm').send({ token, newPassword: 'weak' })).status).toBe(400);
    const ok = await request(app.getHttpServer()).post('/v3/account/password/reset/confirm').send({ token, newPassword: 'NewPassw0rd' }); expect(ok.status).toBe(200); expect(ok.body.data).toEqual({ ok: true });
    const codes: number[] = []; for (let i = 0; i < 6; i++) codes.push((await request(app.getHttpServer()).post('/v3/account/password/reset/request').send({ email: 'x@example.com' })).status);
    expect(codes).toContain(429);
  });
});
