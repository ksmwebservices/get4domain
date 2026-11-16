import { HttpException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { DEFAULT_DIRECTORY_SETTINGS } from '../src/directory/settings/directory-settings';
import { ClaimOtpService } from '../src/provisioning/claims/claim-otp.service';
import { ClaimStartController } from '../src/provisioning/claims/claim-start.controller';
import { ClaimStartService } from '../src/provisioning/claims/claim-start.service';
import { ClaimsService } from '../src/provisioning/claims/claims.service';
import { generateToken, hashToken } from '../src/provisioning/claims/token';
import { DEFAULT_PROVISIONING_SETTINGS } from '../src/provisioning/settings/provisioning-settings';
import { BUSINESS_ERROR_CODES } from '../src/v3-business/business.errors';
import { MAIL_ERROR_CODES } from '../src/v3-mail/mail.errors';
import { directoryWorld, DirectoryWorld, PHONE } from './support/directory-world';
import { MemoryClaimStore, MemoryInviteStore } from './support/memory-claims';

/** Wave 2, public site gaps G1 and G12: start a claim from a listing, and the registered MAIL_DISABLED code. */
jest.setTimeout(120_000);
const codeOf = async (p: Promise<unknown>): Promise<{ status: number; code?: string; message?: string }> => {
  try { await p; } catch (e) { if (e instanceof HttpException) { const b = e.getResponse() as { code?: string; message?: string }; return { status: e.getStatus(), code: b.code, message: b.message }; } throw e; }
  return { status: 0 };
};
const NOW = new Date('2026-11-05T10:00:00.000Z');

/** The real ClaimsService over the memory claim store, so the token rows are real; the directory world gives the listing store, the SMS fake and the grants. */
async function build(opts: { mail?: boolean } = {}) {
  const w: DirectoryWorld = await directoryWorld();
  const store = new MemoryClaimStore(); const invites = new MemoryInviteStore(); store.invites = invites;
  const audit: Array<{ action: string; entityId: string | null; after: unknown; ip: string | null }> = [];
  const claims = new ClaimsService(store, invites, { get: async () => ({ ...DEFAULT_PROVISIONING_SETTINGS }) } as never, { record: async (a: { ip: string | null }, action: string, _t: string, entityId: string | null, after: unknown) => { audit.push({ action, entityId, after, ip: a.ip }); } } as never, {} as never, {} as never);
  claims.clock = () => NOW;
  const mail = { on: opts.mail !== false }; const sent: Array<{ lane: string; kind: string; to: string; subject: string; text: string }> = [];
  const email = { send: async (m: { lane: string; kind: string; to: string; subject: string; text: string }) => { sent.push(m); } };
  const settings = { get: async () => ({ ...DEFAULT_DIRECTORY_SETTINGS }) };
  const otp = new ClaimOtpService(claims, w.repo, settings as never, w.sms, w.grants, w.admin, w.audit, w.pepper, email as never, () => mail.on);
  otp.clock = () => new Date(w.now.t); otp.random = () => 123456; let n = 0; otp.salt = () => `salt-${++n}`;
  const start = new ClaimStartService(w.repo, claims, otp, () => mail.on);
  const listing = async (o: { slug?: string; status?: 'UNCLAIMED' | 'CLAIMED' | 'REMOVED' | 'DRAFT' | 'SUSPENDED'; vendorId?: string | null; email?: string } = {}) => {
    const vendorId = o.vendorId === undefined ? 'v1' : o.vendorId;
    if (vendorId) { w.repo.vendors.set(vendorId, { id: vendorId, name: 'Owner', phone: PHONE, email: o.email ?? 'owner@example.com' }); store.vendors.set(vendorId, 'Acme Plumbing'); store.vendorContacts.set(vendorId, { email: o.email ?? 'owner@example.com', businessName: 'Acme Plumbing' }); }
    return w.biz({ name: 'Acme Plumbing', slug: o.slug ?? 'acme-plumbing', status: o.status ?? 'UNCLAIMED', vendorId, claimedAt: null });
  };
  return { w, store, claims, otp, start, mail, sent, audit, listing };
}

describe('POST /v3/claim/start (G1)', () => {
  it('finds the listing, emails the code to the owner address on the record, and answers the claim token that then drives otp/verify', async () => {
    const t = await build(); await t.listing();
    const r = await t.start.start('acme-plumbing', 'EMAIL', '203.0.113.9');
    expect(r.channel).toBe('EMAIL'); expect(r.token).toMatch(/^[A-Za-z0-9_-]{43}$/); expect(r.message).toMatch(/email address/);
    expect(t.sent).toHaveLength(1); expect(t.sent[0]).toMatchObject({ lane: 'SYSTEM', kind: 'OTP', to: 'owner@example.com' });
    const code = /code is (\d{6})/.exec(t.sent[0].text)![1];
    expect(await t.claims.status(r.token)).toMatchObject({ valid: true, businessName: 'Acme Plumbing' });
    const done = await t.otp.verify(r.token, code, '203.0.113.9'); expect(done).toMatchObject({ claimed: true, vendorId: 'v1' }); expect(done.setupToken.length).toBeGreaterThan(20);
    expect((await t.w.repo.getBusinessBySlug('acme-plumbing'))!.status).toBe('CLAIMED');
  });
  it('the code goes only to the record: a placeholder owner address gets nothing sent, and the answer is the same', async () => {
    const t = await build(); await t.listing({ email: 'site+abc@sites.get4domain.invalid' });
    const r = await t.start.start('acme-plumbing', 'EMAIL', null);
    expect(r.token).toBeTruthy(); expect(t.sent).toEqual([]);
  });
  it('the SMS channel works with the mail switch OFF and goes to the phone on the record', async () => {
    const t = await build({ mail: false }); await t.listing();
    const r = await t.start.start('acme-plumbing', 'SMS', null);
    expect(r.channel).toBe('SMS'); expect(t.w.sms.sent).toEqual([expect.objectContaining({ to: PHONE })]); expect(t.sent).toEqual([]);
  });
  it('every listing that cannot be claimed gets the SAME 409 DIRECTORY_STATE_INVALID: unknown, malformed, claimed, removed, draft, suspended, no vendor', async () => {
    const t = await build(); await t.listing({ slug: 'claimed-biz', status: 'CLAIMED', vendorId: 'v2' }); await t.listing({ slug: 'gone-biz', status: 'REMOVED', vendorId: 'v3' }); await t.listing({ slug: 'draft-biz', status: 'DRAFT', vendorId: 'v4' });
    await t.listing({ slug: 'susp-biz', status: 'SUSPENDED', vendorId: 'v5' }); await t.listing({ slug: 'orphan-biz', vendorId: null });
    const answers = [];
    for (const s of ['nope', 'Not A Slug!', '', 'claimed-biz', 'gone-biz', 'draft-biz', 'susp-biz', 'orphan-biz', 'x'.repeat(200)]) answers.push(await codeOf(t.start.start(s, 'EMAIL', null)));
    for (const a of answers) expect(a).toEqual({ status: 409, code: 'DIRECTORY_STATE_INVALID', message: 'This business cannot be claimed from here.' });
    expect(t.sent).toEqual([]); expect(t.store.rows.length).toBe(0);
  });
  it('a business claimed a moment before (a used token) is refused like any other, and the audit row carries no token', async () => {
    const t = await build(); await t.listing(); const first = await t.start.start('acme-plumbing', 'EMAIL', null);
    await t.claims.redeemClaim(first.token);   // the claim link is used up while the listing row still says UNCLAIMED
    expect(await codeOf(t.start.start('acme-plumbing', 'EMAIL', null))).toMatchObject({ status: 409, code: 'DIRECTORY_STATE_INVALID' });
    expect(t.audit.filter((a) => a.action === 'claim.public_start')).toHaveLength(1); expect(JSON.stringify(t.audit)).not.toContain(first.token);
  });
  it('a second start replaces the first token (one active claim link per business) and records who asked from where', async () => {
    const t = await build(); await t.listing();
    const a = await t.start.start('acme-plumbing', 'EMAIL', '198.51.100.7'); const b = await t.start.start('acme-plumbing', 'EMAIL', '198.51.100.7');
    expect(a.token).not.toBe(b.token); expect(await t.claims.peek(a.token)).toBeNull(); expect(await t.claims.peek(b.token)).not.toBeNull();
    expect(t.audit.filter((x) => x.action === 'claim.public_start').map((x) => x.ip)).toEqual(['198.51.100.7', '198.51.100.7']);
  });
  it('issueForPublicStart stores only a hash and the link expires by the setting', async () => {
    const t = await build(); await t.listing(); const { token } = await t.claims.issueForPublicStart('v1', null);
    const row = t.store.rows.find((r) => r.tokenHash === hashToken(token))!;
    expect(row).toBeDefined(); expect(JSON.stringify(t.store.rows)).not.toContain(token);
    expect(row.expiresAt.getTime()).toBe(NOW.getTime() + DEFAULT_PROVISIONING_SETTINGS.claimLinkExpiryDays * 86_400_000); expect(row.createdByType).toBe('SYSTEM'); void generateToken;
  });
});

describe('MAIL_DISABLED (G12)', () => {
  it('is registered with the exception filter', () => { expect(MAIL_ERROR_CODES).toContain('MAIL_DISABLED'); expect(BUSINESS_ERROR_CODES).toContain('MAIL_DISABLED'); });
  it('start with the email channel and the mail switch OFF is 503 MAIL_DISABLED, and nothing is looked up, issued or sent (the same for a real and an unknown slug)', async () => {
    const t = await build({ mail: false }); await t.listing();
    for (const slug of ['acme-plumbing', 'nope', '???']) expect(await codeOf(t.start.start(slug, 'EMAIL', null))).toMatchObject({ status: 503, code: 'MAIL_DISABLED' });
    expect(t.store.rows.length).toBe(0); expect(t.sent).toEqual([]);
  });
  it('the code request route with channel EMAIL answers MAIL_DISABLED for ANY token while the switch is OFF, and the SMS channel is unchanged', async () => {
    const t = await build({ mail: false });
    for (const token of ['garbage', generateToken()]) expect(await codeOf(t.otp.request(token, null, 'EMAIL'))).toMatchObject({ status: 503, code: 'MAIL_DISABLED' });
    expect(await t.otp.request('garbage', null, 'SMS')).toMatchObject({ sent: true });
  });
  it('with the switch ON the request answers as before (uniform for a bad token)', async () => {
    const t = await build(); expect(await t.otp.request('garbage', null, 'EMAIL')).toMatchObject({ sent: true });
  });
  it('a build without the switch provider keeps the old behaviour (no check)', async () => {
    const t = await build({ mail: false }); const bare = new ClaimStartService(t.w.repo, t.claims, t.otp);
    await t.listing(); expect(await bare.start('acme-plumbing', 'SMS', null)).toMatchObject({ channel: 'SMS' });
  });
});

describe('over HTTP', () => {
  let app: INestApplication; let t: Awaited<ReturnType<typeof build>>;
  beforeEach(async () => {
    t = await build(); await t.listing();
    const mod = await Test.createTestingModule({ imports: [throttlerImport], controllers: [ClaimStartController], providers: [throttlerGuardProvider, { provide: ClaimStartService, useValue: t.start }] }).compile();
    app = mod.createNestApplication(); app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter()); await app.init();
  });
  afterEach(async () => { await app.close(); });
  it('is public, answers the token with 200, defaults to the email channel, and the answer never carries the code', async () => {
    const r = await request(app.getHttpServer()).post('/v3/claim/start').send({ businessSlug: 'acme-plumbing' });
    expect(r.status).toBe(200); expect(r.body.data).toMatchObject({ channel: 'EMAIL' }); expect(r.body.data.token).toMatch(/^[A-Za-z0-9_-]{43}$/); expect(JSON.stringify(r.body)).not.toMatch(/123456/);
  });
  it('an unclaimable listing is 409 with the registered code; email off is 503 with its code', async () => {
    const no = await request(app.getHttpServer()).post('/v3/claim/start').send({ businessSlug: 'nope' }); expect(no.status).toBe(409); expect(JSON.stringify(no.body)).toContain('DIRECTORY_STATE_INVALID');
    t.mail.on = false; const off = await request(app.getHttpServer()).post('/v3/claim/start').send({ businessSlug: 'acme-plumbing' }); expect(off.status).toBe(503); expect(JSON.stringify(off.body)).toContain('MAIL_DISABLED');
  });
  it('a bad body is 400', async () => {
    expect((await request(app.getHttpServer()).post('/v3/claim/start').send({})).status).toBe(400);
    expect((await request(app.getHttpServer()).post('/v3/claim/start').send({ businessSlug: 'acme-plumbing', channel: 'FAX' })).status).toBe(400);
  });
  it('it is rate limited (the code-request limit)', async () => {
    const codes: number[] = []; for (let i = 0; i < 12; i++) codes.push((await request(app.getHttpServer()).post('/v3/claim/start').send({ businessSlug: 'nope' })).status);
    expect(codes).toContain(429);
  });
});
