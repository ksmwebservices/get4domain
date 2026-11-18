import { ChannelIdentityOtpSender } from '../src/v3-mail/identity-otp.sender';
import { FakeEmailTransport, GuardedEmailPort } from '../src/v3-mail/email.port';
import { FakeSmsTransport, GuardedSmsPort, SmsPhoneCodeSender, UnboundSmsTransport } from '../src/v3-mail/sms.port';
import { DEFAULT_MAIL_SETTINGS, MailSettingsService } from '../src/v3-mail/settings/mail-settings';
import { SmsSettingsService } from '../src/v3-mail/settings/sms-settings';
import { UnavailableOtpSender } from '../src/v3-registrar/identity.service';
import { registrarWorld, RegistrarWorld, V1 } from './support/registrar-world';

/** B5.8: identity codes go by e-mail through the guarded lane (its live flag decides), SMS says plainly it is not available. No flag is turned on by any of this. */
type Env = Record<string, string | undefined>;
const mailSettings = (over = {}) => ({ get: async () => ({ ...DEFAULT_MAIL_SETTINGS, mailSystemFromAddress: 'no-reply@send.example.com', mailSystemFromName: 'Get4Domain', ...over }) }) as unknown as MailSettingsService;
const smsSettings = (over = {}) => ({ get: async () => ({ smsPrincipalEntityId: null, smsSenderId: null, smsTemplates: null, ...over }) }) as unknown as SmsSettingsService;
const build = (env: Env, sms = new UnboundSmsTransport() as never) => {
  const transport = new FakeEmailTransport();
  const email = new GuardedEmailPort(transport, mailSettings(), () => env);
  const phone = new SmsPhoneCodeSender(new GuardedSmsPort(sms, smsSettings(), () => env));
  return { sender: new ChannelIdentityOtpSender(email, phone), transport };
};

describe('e-mail codes', () => {
  it('the live flag OFF (the default): the channel is not ready and nothing is sent', async () => {
    const { sender, transport } = build({ RESEND_API_KEY: 'k' });
    expect(await sender.channelReady('EMAIL')).toBe(false);
    await expect(sender.send('EMAIL', 'a@example.com', '123456', 'v1')).rejects.toMatchObject({ response: { code: 'EMAIL_NOT_LIVE' } });
    expect(transport.sent).toHaveLength(0);
  });
  it('flag on and a sender and key set: ready, and the message carries the code only (kind OTP, system lane)', async () => {
    const { sender, transport } = build({ EMAIL_LIVE_SEND: 'true', RESEND_API_KEY: 'k' });
    expect(await sender.channelReady('EMAIL')).toBe(true);
    await sender.send('EMAIL', 'a@example.com', '123456', 'v1');
    expect(transport.sent).toHaveLength(1); expect(transport.sent[0].m).toMatchObject({ lane: 'SYSTEM', kind: 'OTP', to: 'a@example.com' }); expect(transport.sent[0].m.text).toContain('123456');
  });
  it('flag on but the provider key is missing: not ready', async () => { expect(await build({ EMAIL_LIVE_SEND: 'true' }).sender.channelReady('EMAIL')).toBe(false); });
});

describe('SMS codes', () => {
  it('stay off: with no provider bound, or the flag off, or no DLT settings, the phone channel is not ready and the unbound transport refuses', async () => {
    expect(await build({ SMS_LIVE_SEND: 'true' }).sender.channelReady('PHONE')).toBe(false);
    expect(await build({}, new FakeSmsTransport() as never).sender.channelReady('PHONE')).toBe(false);
    await expect(build({ SMS_LIVE_SEND: 'true' }).sender.send('PHONE', '919876543210', '123456', 'v1')).rejects.toBeDefined();
  });
  it('the production unavailable sender is not ready on either channel', async () => { const u = new UnavailableOtpSender(); expect(await u.channelReady()).toBe(false); });
});

describe('identity service: honest states', () => {
  let w: RegistrarWorld; const details = { legalName: 'Meena Ravi', company: 'Sri Ganesh Traders', email: 'meena@example.in', phoneCc: '91', phone: '9876543210', addressLine1: '12 Main Road', city: 'Madurai', state: 'Tamil Nadu', zipcode: '625001' };
  beforeEach(async () => { w = registrarWorld(); await w.open('v1'); await w.identity.saveDetails('v1', details, V1); });
  it('a channel that is not ready is refused with OTP_NOT_AVAILABLE and the plain sentence; no code is made or sent', async () => {
    w.sender.channelReady = async (c) => c === 'EMAIL';
    await expect(w.identity.sendOtp('v1', 'PHONE', V1)).rejects.toMatchObject({ response: { code: 'OTP_NOT_AVAILABLE', message: 'Text message codes are not available yet.' } });
    expect(w.sender.sent).toHaveLength(0); expect(w.rstore.otps).toHaveLength(0);
    await expect(w.identity.sendOtp('v1', 'EMAIL', V1)).resolves.toMatchObject({ sent: true });
  });
  it('a lane switched off between the check and the send still answers "not available", never "try again later"', async () => {
    w.sender.send = async () => { throw Object.assign(new Error('x'), { response: { code: 'EMAIL_NOT_LIVE' } }); };
    await expect(w.identity.sendOtp('v1', 'EMAIL', V1)).rejects.toMatchObject({ response: { code: 'OTP_NOT_AVAILABLE' } });
    expect(w.rstore.otps[0].consumedAt).not.toBeNull();
  });
  it('a real provider failure is still OTP_DELIVERY_FAILED', async () => { w.sender.fail = true; await expect(w.identity.sendOtp('v1', 'EMAIL', V1)).rejects.toMatchObject({ response: { code: 'OTP_DELIVERY_FAILED' } }); });
  it('GET /v3/me/identity tells the app which channels can deliver', async () => {
    w.sender.channelReady = async (c) => c === 'EMAIL';
    expect(await w.identity.mine('v1')).toMatchObject({ codeChannels: { EMAIL: { available: true, text: null }, PHONE: { available: false, text: 'Text message codes are not available yet.' } } });
  });
});
