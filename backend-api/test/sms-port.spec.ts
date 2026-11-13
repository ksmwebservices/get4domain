import { MAX_VAR_LENGTH, buildDltRequest, indianMobile, templatesProblem, SmsTemplate } from '../src/v3-mail/core/sms-core';
import { ChannelIdentityOtpSender } from '../src/v3-mail/identity-otp.sender';
import { DEFAULT_MAIL_SETTINGS, MailSettingsService } from '../src/v3-mail/settings/mail-settings';
import { DEFAULT_SMS_SETTINGS, SmsSettings, SmsSettingsService, resolveSmsSettings, smsSettingProblem } from '../src/v3-mail/settings/sms-settings';
import { FakeEmailTransport, GuardedEmailPort } from '../src/v3-mail/email.port';
import { FakeSmsTransport, GuardedSmsPort, SmsPhoneCodeSender, UnboundSmsTransport } from '../src/v3-mail/sms.port';

const OTP: SmsTemplate = { templateId: '1107161234567890123', text: 'Your Get4Domain code is {#var#}. Do not share it.', kind: 'OTP', status: 'APPROVED' };
const FULL: Partial<SmsSettings> = { smsPrincipalEntityId: '1101234567890123456', smsSenderId: 'GETDMN', smsTemplates: { IDENTITY_OTP: OTP, DRAFT_ONE: { ...OTP, status: 'PENDING' } } };
function port(over: Partial<SmsSettings> = FULL, env: Record<string, string | undefined> = { SMS_LIVE_SEND: 'true' }) {
  const settings = { get: async () => ({ ...DEFAULT_SMS_SETTINGS, ...over }) } as unknown as SmsSettingsService;
  const transport = new FakeSmsTransport(); return { p: new GuardedSmsPort(transport, settings, () => env), transport };
}

describe('SMS (DLT)', () => {
  it('both numbers and templates must be the registered kind: a request carries entity id, sender id, template id and the filled text', async () => {
    const { p, transport } = port(); await p.send({ kind: 'OTP', to: '9876543210', templateKey: 'IDENTITY_OTP', vars: ['123456'] });
    expect(transport.sent).toEqual([{ principalEntityId: '1101234567890123456', senderId: 'GETDMN', templateId: '1107161234567890123', to: '919876543210', text: 'Your Get4Domain code is 123456. Do not share it.' }]);
  });
  it('the flag SMS_LIVE_SEND defaults OFF: nothing is sent', async () => {
    for (const env of [{}, { SMS_LIVE_SEND: 'yes' }, { SMS_LIVE_SEND: 'false' }]) { const { p, transport } = port(FULL, env); await expect(p.send({ kind: 'OTP', to: '9876543210', templateKey: 'IDENTITY_OTP', vars: ['1'] })).rejects.toMatchObject({ response: { code: 'SMS_NOT_LIVE' } }); expect(transport.sent).toHaveLength(0); }
  });
  it('promotion cannot be sent by SMS: only the closed transactional list passes, before anything else is checked', async () => {
    const { p, transport } = port();
    for (const kind of ['PROMOTION', 'MARKETING', 'CAMPAIGN', 'otp', '']) await expect(p.send({ kind, to: '9876543210', templateKey: 'IDENTITY_OTP', vars: ['1'] })).rejects.toMatchObject({ response: { code: 'SMS_KIND_FORBIDDEN' } });
    expect(transport.sent).toHaveLength(0);
  });
  it('refuses while the DLT values are unset, for a template that is pending or unknown, and for a bad number or values', async () => {
    const m = { kind: 'OTP', to: '9876543210', templateKey: 'IDENTITY_OTP', vars: ['1'] };
    await expect(port({ ...FULL, smsSenderId: null }).p.send(m)).rejects.toMatchObject({ response: { code: 'SMS_NOT_CONFIGURED' } });
    await expect(port().p.send({ ...m, templateKey: 'DRAFT_ONE' })).rejects.toMatchObject({ response: { code: 'SMS_TEMPLATE_NOT_APPROVED' } });
    await expect(port().p.send({ ...m, templateKey: 'NOPE' })).rejects.toMatchObject({ response: { code: 'SMS_TEMPLATE_NOT_APPROVED' } });
    await expect(port().p.send({ ...m, to: '12345' })).rejects.toMatchObject({ response: { code: 'SMS_INVALID' } });
    await expect(port().p.send({ ...m, vars: [] })).rejects.toMatchObject({ response: { code: 'SMS_INVALID' } });
    await expect(port().p.send({ ...m, vars: ['x'.repeat(MAX_VAR_LENGTH + 1)] })).rejects.toMatchObject({ response: { code: 'SMS_INVALID' } });
    await expect(port().p.send({ ...m, vars: ['a\nb'] })).rejects.toMatchObject({ response: { code: 'SMS_INVALID' } });
  });
  it('a provider failure is a plain SMS_FAILED; with no provider bound the product transport refuses', async () => {
    const { p, transport } = port(); transport.failNext = true; await expect(p.send({ kind: 'OTP', to: '9876543210', templateKey: 'IDENTITY_OTP', vars: ['1'] })).rejects.toMatchObject({ response: { code: 'SMS_FAILED' } });
    await expect(new UnboundSmsTransport().deliver()).rejects.toMatchObject({ response: { code: 'SMS_NOT_CONFIGURED' } });
  });
  it('Indian mobile numbers in the shapes we hold', () => {
    expect(indianMobile('9876543210')).toBe('919876543210'); expect(indianMobile('+91 98765 43210')).toBe('919876543210'); expect(indianMobile('09876543210')).toBe('919876543210'); expect(indianMobile('919876543210')).toBe('919876543210');
    for (const bad of ['5876543210', '98765', '+1 415 555 0100', 'abc', '']) expect(indianMobile(bad)).toBeNull();
  });
  it('a value that contains the placeholder cannot reshape the text', () => {
    const r = buildDltRequest({ principalEntityId: '1', senderId: 'ABCDEF', templates: { IDENTITY_OTP: OTP } }, { kind: 'OTP', to: '9876543210', templateKey: 'IDENTITY_OTP', vars: ['{#var#}'] }); expect(r.ok).toBe(false);
  });
  it('settings start unset and validate', () => {
    expect(Object.values(resolveSmsSettings(new Map())).every((v) => v === null)).toBe(true);
    expect(smsSettingProblem('smsSenderId', 'ABC')).not.toBeNull(); expect(smsSettingProblem('smsSenderId', 'GETDMN')).toBeNull(); expect(smsSettingProblem('smsPrincipalEntityId', 'abc')).not.toBeNull();
    expect(templatesProblem({ IDENTITY_OTP: OTP })).toBeNull(); expect(templatesProblem({ lower: OTP })).not.toBeNull(); expect(templatesProblem({ A_B: { ...OTP, kind: 'PROMOTION' } })).not.toBeNull(); expect(templatesProblem({ A_B: { ...OTP, status: 'MAYBE' } })).not.toBeNull(); expect(templatesProblem({})).not.toBeNull();
  });
  it('the identity phone code goes through the SMS port with the IDENTITY_OTP template', async () => {
    const { p, transport } = port(); const email = new GuardedEmailPort(new FakeEmailTransport(), { get: async () => DEFAULT_MAIL_SETTINGS } as unknown as MailSettingsService, () => ({}));
    await new ChannelIdentityOtpSender(email, new SmsPhoneCodeSender(p)).send('PHONE', '919876543210', '654321', 'v1');
    expect(transport.sent[0].text).toContain('654321');
  });
});
