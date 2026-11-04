import { ModeSmsAdapter, SmsNotConfigured } from '../src/directory/sms/sms-adapter';
import { DEFAULT_DIRECTORY_SETTINGS } from '../src/directory/settings/directory-settings';
import { advance, directoryWorld, DirectoryWorld, PHONE, STAFF } from './support/directory-world';

/** Slice 5.7: claim by phone OTP. Uniform answers, attempt locking, replay, concurrency, the phone-on-file rule and the sandbox / live guard. */
const TOKEN = 'T'.repeat(43);
const err = async (p: Promise<unknown>): Promise<{ code?: string; message?: string; status?: number }> => {
  try { await p; return {}; } catch (e) { const r = e as { getResponse?: () => unknown; getStatus?: () => number }; const b = (r.getResponse?.() ?? {}) as { code?: string; message?: string }; return { code: b.code, message: b.message, status: r.getStatus?.() }; }
};
let w: DirectoryWorld;
const setup = async (o: { phone?: string | null; vendorPhone?: string | null } = {}) => {
  const biz = await w.biz({ name: 'Unclaimed Co', status: 'UNCLAIMED', vendorId: 'v1', phoneE164: o.phone === undefined ? PHONE : o.phone });
  w.repo.vendors.set('v1', { id: 'v1', name: 'Unclaimed Co', phone: o.vendorPhone ?? null, email: 'u@x.invalid' });
  w.claims.add(TOKEN, 'v1', 'Unclaimed Co');
  return biz;
};
const challenges = () => [...w.repo.challenges.values()];
beforeEach(async () => { w = await directoryWorld(); });

describe('requesting a code', () => {
  it('the code goes to the phone on the business record; the row holds only hashes, a salt and (sandbox) the message; the phone and the code are never in it in clear', async () => {
    await setup();
    const r = await w.otp.request(TOKEN, '1.2.3.4');
    expect(r.sent).toBe(true); expect(w.sms.sent).toHaveLength(1); expect(w.sms.sent[0].to).toBe(PHONE); expect(w.sms.sent[0].body).toContain('123456');
    const c = challenges()[0];
    expect(c).toMatchObject({ subjectType: 'CLAIM', subjectId: `ct-${TOKEN}`, channel: 'SMS', status: 'PENDING', attempts: 0, maxAttempts: 5 });
    expect(c.expiresAt.getTime() - w.now.t.getTime()).toBe(10 * 60_000);
    const { sandboxBody, ...rest } = c; expect(sandboxBody).toContain('123456');
    expect(JSON.stringify(rest)).not.toMatch(/123456|9876543210/); expect(c.codeHash).toMatch(/^[0-9a-f]{64}$/); expect(c.phoneHash).toMatch(/^[0-9a-f]{64}$/);
    expect(c.requestIpHash).toMatch(/^[0-9a-f]{64}$/); expect(c.requestIpHash).not.toContain('1.2.3.4');
    expect(JSON.stringify(w.audit.rows)).not.toMatch(/123456|9876543210/); expect(w.audit.rows[0]).toMatchObject({ action: 'claim.otp.requested' });
  });
  it('UNIFORM: an unknown link, a valid one, a business with no phone, a repeat inside the cooldown and a rate-limited one all get the very same answer', async () => {
    await setup();
    const ok = await w.otp.request(TOKEN, 'ip-1');
    const unknown = await w.otp.request('U'.repeat(43), 'ip-1');
    const again = await w.otp.request(TOKEN, 'ip-1');   // inside the cooldown
    w.claims.add('NOPHONE', 'v2', 'No Phone Co'); w.repo.vendors.set('v2', { id: 'v2', name: 'No Phone Co', phone: null, email: 'n@x.invalid' });
    const noPhone = await w.otp.request('NOPHONE', 'ip-1');
    expect([unknown, again, noPhone]).toEqual([ok, ok, ok]);
    expect(w.sms.sent).toHaveLength(1); expect(challenges()).toHaveLength(1);
  });
  it('the phone is the business record\'s; if the business has none, the vendor\'s registered phone; a staff override wins over both', async () => {
    await setup({ phone: null, vendorPhone: '9111111111' });
    await w.otp.request(TOKEN, null); expect(w.sms.sent.at(-1)!.to).toBe('+919111111111');
    advance(w, 61);
    const biz = (await w.repo.getBusinessByVendor('v1'))!;
    await w.admin.claimPhoneOverride(biz.id, { phone: '9222222222', reason: 'owner changed their number' }, STAFF);
    await w.otp.request(TOKEN, null); expect(w.sms.sent.at(-1)!.to).toBe('+919222222222'); expect(w.sms.sent).toHaveLength(2);
  });
  it('a caller cannot choose the phone: the request takes only the link and the IP', () => { expect(w.otp.request.length).toBe(2); });
  it('resend cooldown: nothing new inside it; after it a new code is sent and the old one stops working', async () => {
    await setup();
    await w.otp.request(TOKEN, null); await w.otp.request(TOKEN, null); expect(challenges()).toHaveLength(1);
    advance(w, 61); await w.otp.request(TOKEN, null);
    expect(challenges()).toHaveLength(2); expect(challenges().filter((c) => c.status === 'PENDING')).toHaveLength(1); expect(challenges()[0].status).toBe('REVOKED');
  });
  it('per-phone and per-IP hourly limits: past the limit no code is created or sent, and the answer does not change', async () => {
    await setup(); w.settings.over = { otpResendCooldownSeconds: 0, otpMaxPerPhonePerHour: 2 };
    for (let i = 0; i < 4; i++) await w.otp.request(TOKEN, `ip-${i}`);
    expect(challenges()).toHaveLength(2);
    advance(w, 3601); w.settings.over = { otpResendCooldownSeconds: 0, otpMaxPerPhonePerHour: 50, otpMaxPerIpPerHour: 2 };
    for (let i = 0; i < 4; i++) await w.otp.request(TOKEN, 'same-ip');
    expect(challenges().filter((c) => c.createdAt.getTime() >= w.now.t.getTime())).toHaveLength(2);
  });
});

describe('verifying a code', () => {
  const body = async (p: Promise<unknown>) => err(p);
  it('the right code: the claim link is used up, the business is CLAIMED and now indexable, a short-lived single-use setup grant is returned, and NO password is set', async () => {
    const biz = await setup(); await w.otp.request(TOKEN, null);
    const r = await w.otp.verify(TOKEN, '123456', null);
    expect(r).toMatchObject({ claimed: true, vendorId: 'v1' }); expect(r.setupToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new Date(r.setupTokenExpiresAt).getTime() - w.now.t.getTime()).toBe(30 * 60_000);
    expect(w.claims.redeemed).toBe(1); expect(await w.claims.peek(TOKEN)).toBeNull();
    expect(await w.repo.getBusiness(biz.id)).toMatchObject({ status: 'CLAIMED', indexable: true }); expect((await w.repo.getBusiness(biz.id))!.claimedAt).toEqual(w.now.t);
    expect(JSON.stringify([...w.repo.grants.values()])).not.toContain(r.setupToken);   // only a hash is stored
    expect(await w.grants.consume(r.setupToken)).toEqual({ vendorId: 'v1' }); expect((await err(w.grants.consume(r.setupToken))).code).toBe('GRANT_INVALID');
    expect(challenges()[0]).toMatchObject({ status: 'VERIFIED' }); expect(challenges()[0].usedAt).toEqual(w.now.t);
    expect(w.audit.rows.map((x) => x.action)).toEqual(expect.arrayContaining(['claim.otp.verified', 'directory.business.claimed', 'account_setup.grant.issued']));
    expect(JSON.stringify(w.audit.rows)).not.toMatch(new RegExp(`123456|${r.setupToken}`));
  });
  it('REPLAY: the same code a second time fails (the link is used up and the challenge is VERIFIED)', async () => {
    await setup(); await w.otp.request(TOKEN, null); await w.otp.verify(TOKEN, '123456', null);
    expect(await body(w.otp.verify(TOKEN, '123456', null))).toMatchObject({ code: 'OTP_INVALID', status: 400 }); expect(w.claims.redeemed).toBe(1);
  });
  it('BRUTE FORCE: five wrong codes lock the challenge; after that even the RIGHT code fails; the link is not used', async () => {
    await setup(); await w.otp.request(TOKEN, null);
    for (let i = 0; i < 5; i++) expect((await body(w.otp.verify(TOKEN, `00000${i}`, null))).code).toBe('OTP_INVALID');
    expect(challenges()[0]).toMatchObject({ attempts: 5, status: 'LOCKED' });
    expect((await body(w.otp.verify(TOKEN, '123456', null))).code).toBe('OTP_INVALID'); expect(w.claims.redeemed).toBe(0);
    expect(w.audit.rows.map((x) => x.action)).toContain('claim.otp.locked');
  });
  it('four wrong codes do not lock: the fifth attempt with the right code still works', async () => {
    await setup(); await w.otp.request(TOKEN, null);
    for (let i = 0; i < 4; i++) await body(w.otp.verify(TOKEN, `00000${i}`, null));
    expect((await w.otp.verify(TOKEN, '123456', null)).claimed).toBe(true);
  });
  it('UNIFORM failure: unknown link, no code requested, wrong code, wrong format, expired and locked all give the identical 400', async () => {
    await setup();
    const none = await body(w.otp.verify(TOKEN, '123456', null));   // no challenge yet
    const unknown = await body(w.otp.verify('U'.repeat(43), '123456', null));
    await w.otp.request(TOKEN, null);
    const wrong = await body(w.otp.verify(TOKEN, '654321', null)); const bad = await body(w.otp.verify(TOKEN, 'abcdef', null)); const short = await body(w.otp.verify(TOKEN, '1', null));
    advance(w, 11 * 60); const expired = await body(w.otp.verify(TOKEN, '123456', null));
    expect(none).toMatchObject({ code: 'OTP_INVALID', status: 400 });
    for (const x of [unknown, wrong, bad, short, expired]) expect(x).toEqual(none);
  });
  it('an expired code fails and the challenge is marked EXPIRED', async () => {
    await setup(); await w.otp.request(TOKEN, null); advance(w, 10 * 60 + 1);
    expect((await body(w.otp.verify(TOKEN, '123456', null))).code).toBe('OTP_INVALID'); expect(challenges()[0].status).toBe('EXPIRED'); expect(w.claims.redeemed).toBe(0);
  });
  it('a new request invalidates the previous code', async () => {
    await setup(); await w.otp.request(TOKEN, null); advance(w, 61);
    let n = 0; w.otp.random = () => (n++ === 0 ? 111111 : 222222); advance(w, 61);
    await w.otp.request(TOKEN, null);
    expect((await body(w.otp.verify(TOKEN, '123456', null))).code).toBe('OTP_INVALID');
    expect((await w.otp.verify(TOKEN, '111111', null)).claimed).toBe(true);
  });
  it('CONCURRENCY: five parallel verifications with the right code: exactly one claim, one redemption, one grant', async () => {
    await setup(); await w.otp.request(TOKEN, null);
    const r = await Promise.all(Array.from({ length: 5 }, () => err(w.otp.verify(TOKEN, '123456', null))));
    expect(r.filter((x) => !x.code)).toHaveLength(1); expect(r.filter((x) => x.code === 'OTP_INVALID')).toHaveLength(4);
    expect(w.claims.redeemed).toBe(1); expect(w.repo.grants.size).toBe(1);
  });
  it('CONCURRENCY: parallel wrong guesses cannot count past the maximum, and none succeeds', async () => {
    await setup(); await w.otp.request(TOKEN, null);
    const r = await Promise.all(Array.from({ length: 12 }, (_, i) => err(w.otp.verify(TOKEN, String(100000 + i), null))));
    expect(r.every((x) => x.code === 'OTP_INVALID')).toBe(true); expect(challenges()[0].attempts).toBeLessThanOrEqual(5);
  });
  it('a business that was not provisioned (no directory profile) can still be claimed: the link is redeemed and a grant issued', async () => {
    w.repo.vendors.set('v9', { id: 'v9', name: 'Plain Co', phone: PHONE, email: 'p@x.invalid' }); w.claims.add('PLAIN', 'v9', 'Plain Co');
    await w.otp.request('PLAIN', null); const r = await w.otp.verify('PLAIN', '123456', null);
    expect(r).toMatchObject({ claimed: true, vendorId: 'v9' });
  });
});

describe('the SMS adapter: sandbox by default, live guarded twice and not wired to a provider', () => {
  const adapter = (mode: 'sandbox' | 'live', env: Record<string, string | undefined>) => { const a = new ModeSmsAdapter({ get: async () => ({ ...DEFAULT_DIRECTORY_SETTINGS, smsAdapterMode: mode }) } as never); a.env = env; return a; };
  it('sandbox: nothing leaves the process, and the message is kept for the staging tests', async () => {
    const a = adapter('sandbox', {}); expect(await a.isSandbox()).toBe(true); await expect(a.send(PHONE, 'hi')).resolves.toBeUndefined();
  });
  it('live in the setting but the environment flag is missing or not exactly "true": still sandbox', async () => {
    for (const env of [{}, { SMS_LIVE_ENABLED: 'false' }, { SMS_LIVE_ENABLED: 'TRUE' }, { SMS_LIVE_ENABLED: '1' }]) expect(await adapter('live', env).isSandbox()).toBe(true);
    expect(await adapter('sandbox', { SMS_LIVE_ENABLED: 'true' }).isSandbox()).toBe(true);
  });
  it('both guards on: not sandbox, and sending fails with ADAPTER_NOT_CONFIGURED because no provider is wired in this slice', async () => {
    const a = adapter('live', { SMS_LIVE_ENABLED: 'true' }); expect(await a.isSandbox()).toBe(false); await expect(a.send(PHONE, 'hi')).rejects.toBeInstanceOf(SmsNotConfigured);
  });
  it('in live mode the code is never kept in the database, and a failed send revokes the challenge while the answer stays uniform', async () => {
    await setup(); w.sms.sandbox = false; w.sms.failNext = true;
    const ok = await w.otp.request(TOKEN, null);
    expect(ok.sent).toBe(true); expect(challenges()[0]).toMatchObject({ sandboxBody: null, status: 'REVOKED' });
    expect((await err(w.otp.verify(TOKEN, '123456', null))).code).toBe('OTP_INVALID');
  });
});
