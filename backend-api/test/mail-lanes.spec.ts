import * as fs from 'fs';
import * as path from 'path';
import { KINDS_BY_LANE, LANE1_KINDS, LANE2_KINDS, OutboundEmail, assertTransactional, forwardSubject, forwardText, mailFlags, planActive, signatureHeader, spamVerdict, subdomainOfAddress, verifySignature, checkInbound } from '../src/v3-mail/core/mail-core';
import { FakeEmailTransport, GuardedEmailPort } from '../src/v3-mail/email.port';
import { DEFAULT_MAIL_SETTINGS, MailSettings, MailSettingsService, mailSettingProblem, resolveMailSettings } from '../src/v3-mail/settings/mail-settings';

const ok: OutboundEmail = { lane: 'SYSTEM', kind: 'OTP', to: 'a@example.com', subject: 'Your code', text: 'Code 123456' };
function port(over: Partial<MailSettings> = {}, env: Record<string, string | undefined> = { EMAIL_LIVE_SEND: 'true', EMAIL_FORWARD_LIVE: 'true' }) {
  const settings = { get: async () => ({ ...DEFAULT_MAIL_SETTINGS, mailSystemFromAddress: 'no-reply@send.example.com', mailSystemFromName: 'Get4Domain', ...over }) } as unknown as MailSettingsService;
  const transport = new FakeEmailTransport(); return { p: new GuardedEmailPort(transport, settings, () => env), transport };
}

describe('THE HARD RULE: lane 1 and lane 2 can never send promotion', () => {
  it('the kinds a lane may send are closed lists with no promotional member', () => {
    for (const k of [...LANE1_KINDS, ...LANE2_KINDS]) expect(k).not.toMatch(/PROMO|CAMPAIGN|NEWSLETTER|MARKETING|BULK|OFFER|DISCOUNT/i);
    expect(KINDS_BY_LANE.SYSTEM).toEqual(['OTP', 'RECEIPT', 'ACCOUNT_NOTICE', 'ENQUIRY_FORWARD']);
  });
  it.each(['PROMOTION', 'CAMPAIGN', 'NEWSLETTER', 'BULK', 'MARKETING', 'otp', ''])('a "%s" message is refused on both lanes before any provider is reached', async (kind) => {
    for (const lane of ['SYSTEM', 'VENDOR_OFFICIAL'] as const) {
      const { p, transport } = port();
      await expect(p.send({ ...ok, lane, kind })).rejects.toMatchObject({ response: { code: 'EMAIL_KIND_FORBIDDEN' } }); expect(transport.sent).toHaveLength(0);
    }
  });
  it('a kind of the other lane is refused too (lane 2 kinds cannot go out on lane 1)', async () => {
    const { p } = port(); await expect(p.send({ ...ok, kind: 'QUOTATION' })).rejects.toMatchObject({ response: { code: 'EMAIL_KIND_FORBIDDEN' } });
  });
  it('exactly one recipient: a list of addresses is refused', async () => {
    const { p, transport } = port();
    for (const to of ['a@example.com, b@example.com', 'a@example.com;b@example.com', 'a@example.com b@example.com']) await expect(p.send({ ...ok, to })).rejects.toMatchObject({ response: { code: 'EMAIL_INVALID' } });
    expect(transport.sent).toHaveLength(0);
  });
  it('no line break in a subject, a name or a reply-to (header injection)', async () => {
    const { p } = port();
    await expect(p.send({ ...ok, subject: 'Hi\r\nBcc: x@y.com' })).rejects.toMatchObject({ response: { code: 'EMAIL_INVALID' } });
    await expect(p.send({ ...ok, fromName: 'A\nB' })).rejects.toMatchObject({ response: { code: 'EMAIL_INVALID' } });
    await expect(p.send({ ...ok, replyTo: 'x@y.com\nBcc: z@y.com' })).rejects.toMatchObject({ response: { code: 'EMAIL_INVALID' } });
  });
  it('lane 2 never sends in this block: it refuses as not live even with every flag on', async () => {
    const { p, transport } = port(); await expect(p.send({ ...ok, lane: 'VENDOR_OFFICIAL', kind: 'QUOTATION' })).rejects.toMatchObject({ response: { code: 'EMAIL_NOT_LIVE' } }); expect(transport.sent).toHaveLength(0);
  });
  it('no source file of the mail module names a promotional kind or builds a bulk send', () => {
    const dir = path.resolve(__dirname, '../src/v3-mail'); const files: string[] = [];
    const walk = (d: string): void => { for (const e of fs.readdirSync(d, { withFileTypes: true })) (e.isDirectory() ? walk(path.join(d, e.name)) : files.push(path.join(d, e.name))); }; walk(dir);
    for (const f of files.filter((x) => x.endsWith('.ts'))) {
      const t = fs.readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
      expect([f, /kind:\s*'(PROMOTION|CAMPAIGN|NEWSLETTER|BULK|MARKETING)'/.test(t)]).toEqual([f, false]);
      expect([f, /to:\s*\[[^\]]*,[^\]]*\]/.test(t)]).toEqual([f, false]);
    }
  });
});

describe('lane 1 sending', () => {
  it('both flags default OFF: nothing is sent and the caller is told it is not live', async () => {
    const { p, transport } = port({}, {}); expect(mailFlags({})).toEqual({ send: false, forward: false });
    await expect(p.send(ok)).rejects.toMatchObject({ response: { code: 'EMAIL_NOT_LIVE' } }); expect(transport.sent).toHaveLength(0);
  });
  it('the flags are separate: forwarding on does not let a code out, and the reverse', async () => {
    const a = port({}, { EMAIL_FORWARD_LIVE: 'true' }); await expect(a.p.send(ok)).rejects.toMatchObject({ response: { code: 'EMAIL_NOT_LIVE' } });
    const b = port({}, { EMAIL_LIVE_SEND: 'true' }); await expect(b.p.send({ ...ok, kind: 'ENQUIRY_FORWARD' })).rejects.toMatchObject({ response: { code: 'EMAIL_NOT_LIVE' } });
    const c = port({}, { EMAIL_LIVE_SEND: 'yes' }); await expect(c.p.send(ok)).rejects.toMatchObject({ response: { code: 'EMAIL_NOT_LIVE' } });
  });
  it('with the flag on and the sender set, a code is sent from the system sender', async () => {
    const { p, transport } = port(); await p.send(ok); expect(transport.sent[0].from).toEqual({ address: 'no-reply@send.example.com', name: 'Get4Domain' });
  });
  it('an unset sender refuses; a provider failure is a plain EMAIL_FAILED with no provider detail', async () => {
    await expect(port({ mailSystemFromAddress: null }).p.send(ok)).rejects.toMatchObject({ response: { code: 'EMAIL_NOT_CONFIGURED' } });
    const { p, transport } = port(); transport.failNext = true; await expect(p.send(ok)).rejects.toMatchObject({ response: { code: 'EMAIL_FAILED', message: 'The message could not be sent right now.' } });
  });
  it('a forwarded enquiry shows the business as the sender name and keeps Reply-To', async () => {
    const { p, transport } = port(); await p.send({ lane: 'SYSTEM', kind: 'ENQUIRY_FORWARD', to: 'v@example.com', subject: 'Enquiry: x', text: 't', replyTo: 'c@example.com', fromName: 'Meena' });
    expect(transport.sent[0].from.name).toBe('Meena via Get4Domain'); expect(transport.sent[0].m.replyTo).toBe('c@example.com');
  });
});

describe('pure mail rules', () => {
  it('an address belongs to a business only as <anything>@<subdomain>.<base>', () => {
    expect(subdomainOfAddress('info@acme.get4domain.com', 'get4domain.com')).toBe('acme');
    for (const bad of ['info@get4domain.com', 'info@a.b.get4domain.com', 'info@acme.example.com', 'info@-bad.get4domain.com', 'nonsense', '@acme.get4domain.com']) expect(subdomainOfAddress(bad, 'get4domain.com')).toBeNull();
  });
  it('the plan is active only for V3, not suspended, active or in grace', () => {
    expect(planActive({ mode: 'V3', suspended: false, subscriptionStatus: 'ACTIVE' })).toBe(true); expect(planActive({ mode: 'V3', suspended: false, subscriptionStatus: 'GRACE' })).toBe(true);
    for (const s of ['EXPIRED', 'CANCELLED', null] as const) expect(planActive({ mode: 'V3', suspended: false, subscriptionStatus: s })).toBe(false);
    expect(planActive({ mode: 'V3', suspended: true, subscriptionStatus: 'ACTIVE' })).toBe(false); expect(planActive({ mode: 'LEGACY', suspended: false, subscriptionStatus: 'ACTIVE' })).toBe(false);
  });
  it('the signature binds the body and the time', () => {
    const body = '{"a":1}'; const h = signatureHeader('s3cret', body, 1000);
    expect(verifySignature('s3cret', h, body, 1000)).toBe(true); expect(verifySignature('s3cret', h, body, 1299)).toBe(true);
    expect(verifySignature('s3cret', h, body, 1301)).toBe(false); expect(verifySignature('s3cret', h, '{"a":2}', 1000)).toBe(false); expect(verifySignature('other', h, body, 1000)).toBe(false);
    expect(verifySignature(undefined, h, body, 1000)).toBe(false); expect(verifySignature('s3cret', undefined, body, 1000)).toBe(false); expect(verifySignature('s3cret', 't=1000,v1=zz', body, 1000)).toBe(false);
  });
  it('the inbound shape is checked and line breaks leave the subject', () => {
    const good = { to: 'x@acme.get4domain.com', from: 'c@example.com', subject: 'Hi\r\nthere', text: 'body', sizeBytes: 10 };
    const r = checkInbound(good); expect(r.ok && r.value.subject).toBe('Hi there');
    expect(checkInbound({ ...good, from: 'bad' }).ok).toBe(false); expect(checkInbound({ ...good, text: undefined }).ok).toBe(false); expect(checkInbound({ ...good, spamScore: 'x' }).ok).toBe(false); expect(checkInbound({ ...good, sizeBytes: -1 }).ok).toBe(false);
  });
  it('spam: above the threshold only; no score invents no verdict', () => { expect(spamVerdict(5.1, 5)).toBe('SPAM'); expect(spamVerdict(5, 5)).toBe('CLEAN'); expect(spamVerdict(null, 5)).toBe('CLEAN'); });
  it('forwarded text names the sender; the subject is bounded', () => {
    expect(forwardText({ from: 'c@example.com', fromName: 'Meena', subject: 's', text: 'hello' })).toBe('New enquiry from Meena <c@example.com>\n\nhello'); expect(forwardSubject('')).toBe('Enquiry'); expect(forwardSubject('x'.repeat(500))).toHaveLength(200);
    expect(assertTransactional({ ...ok })).toBeNull();
  });
  it('settings start unset and validate', () => {
    expect(Object.values(resolveMailSettings(new Map())).every((v) => v === null)).toBe(true);
    expect(mailSettingProblem('mailSystemFromAddress', 'nope')).not.toBeNull(); expect(mailSettingProblem('mailSystemFromName', 'A\nB')).not.toBeNull(); expect(mailSettingProblem('inboxMaxBytes', 0)).not.toBeNull(); expect(mailSettingProblem('inboxSpamThreshold', 5.5)).toBeNull();
  });
});

describe('identity one-time codes', () => {
  it('an email code goes out on lane 1 as kind OTP with the code and no timeframe; the phone channel refuses until the SMS port is bound', async () => {
    const { ChannelIdentityOtpSender, NoPhoneCodeSender } = await import('../src/v3-mail/identity-otp.sender');
    const { p, transport } = port(); const s = new ChannelIdentityOtpSender(p, new NoPhoneCodeSender());
    await s.send('EMAIL', 'owner@example.com', '123456', 'v1');
    expect(transport.sent[0].m).toMatchObject({ lane: 'SYSTEM', kind: 'OTP', to: 'owner@example.com' }); expect(transport.sent[0].m.text).toContain('123456'); expect(transport.sent[0].m.text).not.toMatch(/minute|hour|second|day|within|expires/i);
    await expect(s.send('PHONE', '919876543210', '123456', 'v1')).rejects.toThrow('OTP_DELIVERY_NOT_CONNECTED');
  });
  it('with the flag OFF the code cannot be sent (the identity service then makes the code unusable)', async () => {
    const { ChannelIdentityOtpSender, NoPhoneCodeSender } = await import('../src/v3-mail/identity-otp.sender');
    const { p } = port({}, {}); await expect(new ChannelIdentityOtpSender(p, new NoPhoneCodeSender()).send('EMAIL', 'o@example.com', '123456', 'v1')).rejects.toMatchObject({ response: { code: 'EMAIL_NOT_LIVE' } });
  });
});
