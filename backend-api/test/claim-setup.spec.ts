import * as bcrypt from 'bcryptjs';
import { evaluateBusinessIndexing } from '../src/directory/core/indexing';
import { DEFAULT_DIRECTORY_SETTINGS } from '../src/directory/settings/directory-settings';
import { ClaimAccountStore } from '../src/claim-setup/claim-account.store';
import { ClaimSetupService } from '../src/claim-setup/claim-setup.service';
import { SiteGoLivePort } from '../src/claim-setup/site-go-live.port';
import { ClaimOtpService } from '../src/provisioning/claims/claim-otp.service';
import { listingStateOf } from '../src/seeded-sites/core/seeded';
import { EmailPort } from '../src/v3-mail/email.port';
import { OutboundEmail } from '../src/v3-mail/core/mail-core';
import { directoryWorld, DirectoryWorld, PHONE } from './support/directory-world';

/** Amendment 13 Part B (B1, B3, B4, B7): the claim code by email, account setup, approval that puts the site live, the four listing states and the indexing default. In-memory twins, no network. */
const TOKEN = 'T'.repeat(43);
const code = (e: unknown): string | undefined => (e as { getResponse?: () => { code?: string } }).getResponse?.().code;
const failure = async (p: Promise<unknown>): Promise<{ status?: number; code?: string }> => { try { await p; return {}; } catch (e) { return { status: (e as { getStatus?: () => number }).getStatus?.(), code: code(e) }; } };

class FakeEmail extends EmailPort { sent: OutboundEmail[] = []; fail = false; async send(m: OutboundEmail): Promise<void> { if (this.fail) throw new Error('lane is off'); this.sent.push(m); } }
class FakeAccounts extends ClaimAccountStore {
  constructor(private readonly vendors: Map<string, { id: string; email: string }>) { super(); }
  credentials = new Map<string, { passwordHash: string; at: Date }>();
  async vendorIdByEmail(email: string) { return [...this.vendors.values()].find((v) => v.email.toLowerCase() === email.toLowerCase())?.id ?? null; }
  async setCredentials(vendorId: string, d: { passwordHash: string; email: string | null; at: Date }) { const v = this.vendors.get(vendorId); if (v && d.email) v.email = d.email; this.credentials.set(vendorId, { passwordHash: d.passwordHash, at: d.at }); }
}
class FakeSite extends SiteGoLivePort {
  live = new Map<string, { publicationId: string; version: number }>(); calls: string[] = []; fail = false;
  async current(v: string) { return this.live.get(v) ?? null; }
  async buildAndPublish(v: string) { if (this.fail) throw new Error('renderer down'); this.calls.push(v); const r = { publicationId: `pub-${v}`, version: 1 }; this.live.set(v, r); return r; }
}

async function setup(o: { email?: string } = {}) {
  const w: DirectoryWorld = await directoryWorld();
  const email = new FakeEmail();
  const otp = new ClaimOtpService(w.claims as never, w.repo, { get: async () => ({ ...DEFAULT_DIRECTORY_SETTINGS }) } as never, w.sms, w.grants, w.admin, w.audit, w.pepper, email);
  otp.clock = () => new Date(w.now.t); otp.random = () => 123456; let n = 0; otp.salt = () => `salt-${++n}`;
  const site = new FakeSite(); let termsOutstanding = false;
  const accounts = new FakeAccounts(w.repo.vendors);
  const svc = new ClaimSetupService(w.grants, w.repo, w.audit, site, accounts, { acceptanceRequired: async () => termsOutstanding } as never);
  svc.clock = () => new Date(w.now.t);
  await w.biz({ name: 'Unclaimed Co', status: 'UNCLAIMED', vendorId: 'v1', phoneE164: PHONE });
  w.repo.vendors.set('v1', { id: 'v1', name: 'Unclaimed Co', phone: null, email: o.email ?? 'owner@example.com' });
  w.claims.add(TOKEN, 'v1', 'Unclaimed Co');
  return { w, email, otp, svc, site, accounts, setTerms: (v: boolean) => { termsOutstanding = v; } };
}

describe('B7 the claim code by email', () => {
  it('goes to the owner\'s login email on the record, on the system lane as kind OTP, and not by SMS', async () => {
    const { w, email, otp } = await setup();
    const r = await otp.request(TOKEN, '1.2.3.4', 'EMAIL');
    expect(r.sent).toBe(true); expect(r.message).toMatch(/email address/);
    expect(email.sent).toHaveLength(1); expect(w.sms.sent).toHaveLength(0);
    expect(email.sent[0]).toMatchObject({ lane: 'SYSTEM', kind: 'OTP', to: 'owner@example.com' });
    expect(email.sent[0].text).toContain('123456'); expect(email.sent[0].text).not.toMatch(/promotion|offer|discount|₹/i);
  });
  it('the emailed code verifies the claim and returns the account-setup grant (the same path as the SMS code)', async () => {
    const { otp } = await setup();
    await otp.request(TOKEN, null, 'EMAIL');
    const v = await otp.verify(TOKEN, '123456', null);
    expect(v).toMatchObject({ claimed: true, vendorId: 'v1' }); expect(v.setupToken.length).toBeGreaterThan(20);
  });
  it('the answer is the same for a bad link, a business with no real email, and a good link (nothing can be learned)', async () => {
    const { email, otp, w } = await setup({ email: 'owner@sites.get4domain.invalid' });
    const noEmail = await otp.request(TOKEN, null, 'EMAIL'); const bad = await otp.request('U'.repeat(43), null, 'EMAIL');
    expect(noEmail).toEqual(bad); expect(email.sent).toHaveLength(0); expect(w.sms.sent).toHaveLength(0);
  });
  it('the default channel is still SMS to the phone on the record', async () => {
    const { w, email, otp } = await setup();
    await otp.request(TOKEN, null);
    expect(w.sms.sent).toHaveLength(1); expect(email.sent).toHaveLength(0);
  });
  it('when the lane is off (the port refuses) the code is revoked: nobody can use a code that was never sent', async () => {
    const { email, otp } = await setup(); email.fail = true;
    await otp.request(TOKEN, null, 'EMAIL');
    expect((await failure(otp.verify(TOKEN, '123456', null))).code).toBe('OTP_INVALID');
  });
  it('a wrong emailed code is the one uniform OTP_INVALID', async () => {
    const { otp } = await setup(); await otp.request(TOKEN, null, 'EMAIL');
    expect((await failure(otp.verify(TOKEN, '000000', null))).code).toBe('OTP_INVALID');
  });
});

describe('B7 account setup: redeeming the grant', () => {
  const claimed = async (o: { email?: string } = {}) => {
    const s = await setup(o); await s.otp.request(TOKEN, null, 'EMAIL'); const v = await s.otp.verify(TOKEN, '123456', null); return { ...s, grant: v.setupToken };
  };
  it('sets the password and records the acceptance, spends the grant once, and says to log in', async () => {
    const { svc, grant, w, accounts } = await claimed();
    const r = await svc.setup({ setupToken: grant, password: 'a-long-password', acceptTerms: true }, { ip: null, userAgent: null });
    expect(r).toEqual({ vendorId: 'v1', loginEmail: 'owner@example.com', passwordSet: true, termsAccepted: true, next: 'LOGIN' });
    const cred = accounts.credentials.get('v1')!;
    expect(await bcrypt.compare('a-long-password', cred.passwordHash)).toBe(true); expect(cred.passwordHash).not.toContain('a-long-password');
    expect(w.audit.rows.some((a) => a.action === 'claim.account_setup')).toBe(true);
    expect((await failure(svc.setup({ setupToken: grant, password: 'another-password', acceptTerms: true }, { ip: null, userAgent: null }))).code).toBe('GRANT_INVALID');   // single use
  });
  it('refuses without the terms accepted, and leaves the grant usable', async () => {
    const { svc, grant } = await claimed();
    expect((await failure(svc.setup({ setupToken: grant, password: 'a-long-password', acceptTerms: false }, { ip: null, userAgent: null }))).code).toBe('CLAIM_TERMS_REQUIRED');
    await expect(svc.setup({ setupToken: grant, password: 'a-long-password', acceptTerms: true }, { ip: null, userAgent: null })).resolves.toMatchObject({ passwordSet: true });
  });
  it('a business made on its behalf (no real email) must give one; one used by another account is refused; both leave the grant usable', async () => {
    const s = await setup({ email: 'owner@sites.get4domain.invalid' }); await s.otp.request(TOKEN, null); const v = await s.otp.verify(TOKEN, '123456', null);
    s.w.repo.vendors.set('other', { id: 'other', name: 'Other', phone: null, email: 'taken@example.com' });
    expect((await failure(s.svc.setup({ setupToken: v.setupToken, password: 'a-long-password', acceptTerms: true }, { ip: null, userAgent: null }))).code).toBe('CLAIM_EMAIL_REQUIRED');
    expect(await failure(s.svc.setup({ setupToken: v.setupToken, password: 'a-long-password', acceptTerms: true, email: 'Taken@Example.com' }, { ip: null, userAgent: null }))).toEqual({ status: 409, code: 'CLAIM_EMAIL_TAKEN' });
    const ok = await s.svc.setup({ setupToken: v.setupToken, password: 'a-long-password', acceptTerms: true, email: 'new.owner@example.com' }, { ip: null, userAgent: null });
    expect(ok.loginEmail).toBe('new.owner@example.com'); expect((await s.w.repo.vendorBasics('v1'))!.email).toBe('new.owner@example.com');
  });
  it('a made-up, an expired and a used grant are the same 404', async () => {
    const { svc, grant, w } = await claimed();
    const a = await failure(svc.setup({ setupToken: 'x'.repeat(30), password: 'a-long-password', acceptTerms: true }, { ip: null, userAgent: null }));
    w.now.t = new Date(w.now.t.getTime() + 24 * 3_600_000);
    const b = await failure(svc.setup({ setupToken: grant, password: 'a-long-password', acceptTerms: true }, { ip: null, userAgent: null }));
    expect(a).toEqual({ status: 404, code: 'GRANT_INVALID' }); expect(b).toEqual(a);
  });
});

describe('B7 approval: the site goes live', () => {
  const actor = { type: 'VENDOR' as const, id: 'v1', ip: null };
  it('a business that is not claimed cannot be approved', async () => {
    const { svc, site } = await setup();
    expect(await failure(svc.approve('v1', actor))).toEqual({ status: 409, code: 'CLAIM_NOT_CLAIMED' }); expect(site.calls).toEqual([]);
  });
  it('a claimed business with the current terms outstanding cannot be approved; after accepting it goes live once and repeating changes nothing', async () => {
    const { svc, site, otp, setTerms, w } = await setup(); await otp.request(TOKEN, null); await otp.verify(TOKEN, '123456', null);
    setTerms(true);
    expect(await failure(svc.approve('v1', actor))).toEqual({ status: 409, code: 'CLAIM_TERMS_REQUIRED' });
    setTerms(false);
    const first = await svc.approve('v1', actor);
    expect(first).toEqual({ state: 'LIVE', alreadyLive: false, publicationId: 'pub-v1', version: 1 });
    const second = await svc.approve('v1', actor);
    expect(second.alreadyLive).toBe(true); expect(site.calls).toEqual(['v1']);
    expect(w.audit.rows.filter((a) => a.action === 'claim.approved')).toHaveLength(1);
  });
  it('a site engine failure is a clear, retryable answer, never a half state', async () => {
    const { svc, site, otp } = await setup(); await otp.request(TOKEN, null); await otp.verify(TOKEN, '123456', null);
    site.fail = true;
    expect(await failure(svc.approve('v1', actor))).toEqual({ status: 409, code: 'CLAIM_GO_LIVE_UNAVAILABLE' });
    site.fail = false; await expect(svc.approve('v1', actor)).resolves.toMatchObject({ state: 'LIVE' });
  });
  it('another business is never approved by this one: v2 has no claimed business, so it is refused', async () => {
    const { svc, otp } = await setup(); await otp.request(TOKEN, null); await otp.verify(TOKEN, '123456', null);
    expect((await failure(svc.approve('v2', { ...actor, id: 'v2' }))).code).toBe('CLAIM_NOT_CLAIMED');
  });
});

describe('B1 the four listing states', () => {
  it.each([
    ['SEEDED', false, 'DRAFT_SITE'], ['SEEDED', true, 'UNCLAIMED_LISTING'], ['INVITED', false, 'DRAFT_SITE'], ['INVITED', true, 'UNCLAIMED_LISTING'],
    ['CLAIMED_FREE', false, 'CLAIMED'], ['CLAIMED_FREE', true, 'LIVE'], ['PRO', false, 'LIVE'], ['PRO', true, 'LIVE'], ['REMOVED', true, 'REMOVED'], ['REMOVED', false, 'REMOVED'],
  ] as const)('%s with a published site: %s is %s', (lifecycle, sitePublished, state) => {
    expect(listingStateOf({ lifecycle, sitePublished })).toBe(state);
  });
});

describe('B4 indexing control', () => {
  const unclaimed = { status: 'UNCLAIMED', name: 'Acme Plumbing', categoryId: 'c', locationId: 'l', phoneE164: PHONE, addressLine: '1 Main Road', descriptionText: 'x'.repeat(400) };
  it('an unclaimed listing is not indexable by default; only the flag (default OFF, SUPER_ADMIN, counsel) allows it; a claimed business is indexable', () => {
    expect(DEFAULT_DIRECTORY_SETTINGS.directoryIndexUnclaimed).toBe(false);
    expect(evaluateBusinessIndexing(unclaimed, { indexUnclaimed: false, minDescriptionChars: 0 }).indexable).toBe(false);
    expect(evaluateBusinessIndexing(unclaimed, { indexUnclaimed: true, minDescriptionChars: 0 }).indexable).toBe(true);
    expect(evaluateBusinessIndexing({ ...unclaimed, status: 'CLAIMED' }, { indexUnclaimed: false, minDescriptionChars: 0 }).indexable).toBe(true);
  });
});
