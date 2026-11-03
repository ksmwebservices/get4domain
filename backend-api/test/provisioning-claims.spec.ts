import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ClaimStore } from '../src/provisioning/claims/claim-store';
import { ClaimPublicController } from '../src/provisioning/claims/claims-public.controller';
import { ClaimsService } from '../src/provisioning/claims/claims.service';
import { generateToken, hashToken } from '../src/provisioning/claims/token';
import { EmailService } from '../src/email/email.service';
import { InviteStore } from '../src/provisioning/invites/invite-store';
import { INVITE_ENV } from '../src/provisioning/steps/send-invite.step';
import { ProvisioningAudit } from '../src/provisioning/runner/job-runner.service';
import { DEFAULT_PROVISIONING_SETTINGS } from '../src/provisioning/settings/provisioning-settings';
import { ProvisioningSettingsService } from '../src/provisioning/settings/provisioning-settings.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { MemoryClaimStore, MemoryInviteStore } from './support/memory-claims';

/** S53.6: the claim status endpoint, redeemClaim, reissue and revoke. Memory stores; the HTTP part runs the real throttler. */
const STAFF = { type: 'STAFF' as const, id: 'staff-1', ip: '1.2.3.4' };
const NOW = new Date('2026-11-04T10:00:00Z');

function world(opts: { vendorEmail?: string } = {}) {
  const claims = new MemoryClaimStore(); const invites = new MemoryInviteStore(); claims.invites = invites;
  claims.vendors.set('v1', 'Sri Ganesh Plumbing');
  claims.vendorContacts.set('v1', { email: opts.vendorEmail ?? 'ganesh@example.com', businessName: 'Sri Ganesh Plumbing' });
  const audit: Array<{ action: string; entityId: string | null; after: unknown }> = [];
  const sink: ProvisioningAudit = { record: async (_a, action, _t, entityId, after) => { audit.push({ action, entityId, after }); } };
  const mail = { sendPlainText: jest.fn(async () => undefined) };
  const settings = { get: async () => ({ ...DEFAULT_PROVISIONING_SETTINGS }) } as unknown as ProvisioningSettingsService;
  const svc = new ClaimsService(claims, invites, settings, sink, mail as never, {} as never);
  svc.clock = () => NOW;
  return { claims, invites, audit, mail, svc };
}
async function issue(w: ReturnType<typeof world>, days = 14) {
  const raw = generateToken();
  const { id } = await w.claims.issue({ vendorId: 'v1', tokenHash: hashToken(raw), expiresAt: new Date(NOW.getTime() + days * 86_400_000), actor: STAFF });
  return { raw, id };
}
const uniform = (e: unknown) => expect(e).toMatchObject({ status: 404, response: { code: 'CLAIM_INVALID', message: 'This link is not valid.' } });

describe('status()', () => {
  it('a valid token returns only valid, the public business name and the expiry', async () => {
    const w = world(); const { raw } = await issue(w);
    expect(await w.svc.status(raw)).toEqual({ valid: true, businessName: 'Sri Ganesh Plumbing', expiresAt: new Date(NOW.getTime() + 14 * 86_400_000).toISOString() });
  });
  it('unknown, malformed, used, revoked and expired tokens all give the SAME 404 (no oracle)', async () => {
    const w = world();
    const used = await issue(w); await w.claims.markUsed(used.id, NOW);
    const revoked = await issue(w); await w.claims.revokeActive('v1');
    const expired = await issue(w, -1);
    for (const raw of [generateToken(), 'short', '', 'x'.repeat(500), used.raw, revoked.raw, expired.raw]) {
      const e = await w.svc.status(raw).catch((x) => x);
      uniform(e);
    }
    expect(JSON.stringify(await w.svc.status(generateToken()).catch((x) => x.response))).toBe(JSON.stringify(await w.svc.status(used.raw).catch((x) => x.response)));
  });
  it('an expired token is marked EXPIRED on the way', async () => {
    const w = world(); const expired = await issue(w, -1);
    await w.svc.status(expired.raw).catch(() => undefined);
    expect(w.claims.rows.find((r) => r.id === expired.id)!.status).toBe('EXPIRED');
  });
});

describe('redeemClaim()', () => {
  it('marks the token USED and returns the vendor id; the sandbox body of its invite is cleared; it audits without the token', async () => {
    const w = world(); const { raw, id } = await issue(w);
    await w.invites.create({ vendorId: 'v1', channel: 'EMAIL', toAddress: 'a@b.com', claimTokenId: id, adapterMode: 'SANDBOX', subject: 's', bodyPreview: 'p', sandboxBody: `link ${raw}` });
    expect(await w.svc.redeemClaim(raw)).toEqual({ vendorId: 'v1' });
    expect(w.claims.rows[0]).toMatchObject({ status: 'USED', usedAt: NOW, activeKey: null });
    expect(w.invites.rows[0].sandboxBody).toBeNull();
    expect(w.audit.map((a) => a.action)).toContain('claim.redeemed');
    expect(JSON.stringify(w.audit)).not.toContain(raw);
  });
  it('works exactly once: the second attempt, a revoked token, an expired token and nonsense all fail with CLAIM_INVALID', async () => {
    const w = world(); const a = await issue(w);
    await w.svc.redeemClaim(a.raw);
    await expect(w.svc.redeemClaim(a.raw)).rejects.toMatchObject({ response: { code: 'CLAIM_INVALID' } });
    const b = await issue(w); await w.claims.revokeActive('v1');
    await expect(w.svc.redeemClaim(b.raw)).rejects.toMatchObject({ response: { code: 'CLAIM_INVALID' } });
    const c = await issue(w, -1);
    await expect(w.svc.redeemClaim(c.raw)).rejects.toMatchObject({ response: { code: 'CLAIM_INVALID' } });
    await expect(w.svc.redeemClaim('nonsense')).rejects.toMatchObject({ response: { code: 'CLAIM_INVALID' } });
  });
  it('RACE: two redeems at once, exactly one wins', async () => {
    const w = world(); const { raw } = await issue(w);
    const results = await Promise.allSettled([w.svc.redeemClaim(raw), w.svc.redeemClaim(raw), w.svc.redeemClaim(raw)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(2);
    expect(w.claims.rows.filter((r) => r.status === 'USED')).toHaveLength(1);
  });
  it('creates no account and sets no password: it only returns the vendor id', async () => {
    const w = world(); const { raw } = await issue(w);
    expect(Object.keys(await w.svc.redeemClaim(raw))).toEqual(['vendorId']);
  });
});

describe('reissue() and revoke()', () => {
  it('reissue revokes the old link, issues a new one, sends a new invite (sandbox) and audits; the response never contains a token', async () => {
    const w = world(); const old = await issue(w);
    const r = await w.svc.reissue('v1', STAFF);
    expect(Object.keys(r).sort()).toEqual(['claimTokenId', 'expiresAt', 'inviteId']);
    expect(w.claims.rows.map((x) => x.status)).toEqual(['REVOKED', 'ACTIVE']);
    expect(w.invites.rows).toHaveLength(1);
    expect(w.invites.rows[0]).toMatchObject({ vendorId: 'v1', toAddress: 'ganesh@example.com', status: 'SENT', adapterMode: 'SANDBOX' });
    expect(w.mail.sendPlainText).not.toHaveBeenCalled();
    expect(JSON.stringify(r)).not.toContain(old.raw);
    expect(w.audit.find((a) => a.action === 'claim.reissue')).toBeDefined();
    const raw = /\/claim\/([A-Za-z0-9_-]{43})/.exec(w.invites.rows[0].sandboxBody!)![1];
    expect((await w.svc.status(raw)).valid).toBe(true);
    await expect(w.svc.status(old.raw)).rejects.toMatchObject({ status: 404 });
  });
  it('reissue refuses a business that already claimed, a business with no real owner email, and an unknown business', async () => {
    const w = world(); const a = await issue(w); await w.svc.redeemClaim(a.raw);
    await expect(w.svc.reissue('v1', STAFF)).rejects.toMatchObject({ status: 409, response: { code: 'CLAIM_INVALID' } });
    const w2 = world({ vendorEmail: 'site+x@sites.get4domain.invalid' });
    await expect(w2.svc.reissue('v1', STAFF)).rejects.toMatchObject({ status: 400 });
    await expect(world().svc.reissue('nope', STAFF)).rejects.toMatchObject({ status: 404, response: { code: 'UNKNOWN_VENDOR' } });
  });
  it('REGRESSION (staging run): an address that merely ends in .invalid is a real owner address as far as reissue is concerned; only the platform placeholder address is refused', async () => {
    for (const email of ['owner@v3test.invalid', 'someone@example.invalid']) {
      const w = world({ vendorEmail: email });
      const r = await w.svc.reissue('v1', STAFF);
      expect(r.inviteId).toBeDefined();
      expect(w.invites.rows[0].toAddress).toBe(email);
    }
    const placeholder = world({ vendorEmail: 'site+acme@sites.get4domain.invalid' });
    await expect(placeholder.svc.reissue('v1', STAFF)).rejects.toMatchObject({ status: 400 });
    expect(placeholder.invites.rows).toHaveLength(0);
  });

  it('reissue works after a revoke and after an expiry (only a USED link blocks it)', async () => {
    const w = world();
    const a = await issue(w); await w.svc.revoke('v1', STAFF);
    await expect(w.svc.reissue('v1', STAFF)).resolves.toBeDefined();
    const b = await issue(w, -1);
    await expect(w.svc.reissue('v1', STAFF)).resolves.toBeDefined();
    expect(a.raw).not.toBe(b.raw);
  });

  it('revoke kills the active link, clears the sandbox body and audits; revoking with nothing active is fine', async () => {
    const w = world(); const { raw, id } = await issue(w);
    await w.invites.create({ vendorId: 'v1', channel: 'EMAIL', toAddress: 'a@b.com', claimTokenId: id, adapterMode: 'SANDBOX', subject: 's', bodyPreview: 'p', sandboxBody: `link ${raw}` });
    expect(await w.svc.revoke('v1', STAFF)).toEqual({ revoked: 1 });
    expect(w.invites.rows[0].sandboxBody).toBeNull();
    await expect(w.svc.status(raw)).rejects.toMatchObject({ status: 404 });
    expect(await w.svc.revoke('v1', STAFF)).toEqual({ revoked: 0 });
    expect(w.audit.filter((a) => a.action === 'claim.revoke')).toHaveLength(2);
  });
});

describe('GET /v3/claim/:token/status (HTTP, real throttler)', () => {
  let app: INestApplication; let w: ReturnType<typeof world>;
  beforeAll(async () => {
    w = world();
    const mod = await Test.createTestingModule({
      imports: [throttlerImport],
      controllers: [ClaimPublicController],
      providers: [
        ClaimsService, throttlerGuardProvider,
        { provide: ClaimStore, useValue: w.claims }, { provide: InviteStore, useValue: w.invites }, { provide: ProvisioningAudit, useValue: { record: async () => undefined } },
        { provide: ProvisioningSettingsService, useValue: { get: async () => ({ ...DEFAULT_PROVISIONING_SETTINGS }) } },
        { provide: EmailService, useValue: { sendPlainText: async () => undefined } }, { provide: INVITE_ENV, useValue: {} },
      ],
    }).compile();
    app = mod.createNestApplication(); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('needs no login; a valid token gives 200 with the public fields only', async () => {
    const { raw } = await issue(w);
    const res = await request(app.getHttpServer()).get(`/v3/claim/${raw}/status`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ valid: true, businessName: 'Sri Ganesh Plumbing', expiresAt: expect.any(String) });
  });
  it('every invalid token gives the identical 404 body', async () => {
    const used = await issue(w); await w.claims.markUsed(used.id, new Date());
    const a = await request(app.getHttpServer()).get(`/v3/claim/${generateToken()}/status`);
    const b = await request(app.getHttpServer()).get(`/v3/claim/${used.raw}/status`);
    const c = await request(app.getHttpServer()).get('/v3/claim/short/status');
    for (const r of [a, b, c]) { expect(r.status).toBe(404); expect(r.body.code).toBe('CLAIM_INVALID'); }
    const strip = (r: request.Response) => JSON.stringify({ ...r.body, timestamp: undefined });
    expect(strip(a)).toBe(strip(b)); expect(strip(a)).toBe(strip(c));
  });
  it('is rate limited per IP: a burst of guesses ends in 429', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 40; i++) codes.push((await request(app.getHttpServer()).get(`/v3/claim/${generateToken()}/status`)).status);
    expect(codes).toContain(429);
    expect(codes.indexOf(429)).toBeLessThanOrEqual(30);
  });
});
