import { Injectable, Optional } from '@nestjs/common';
import { DltConfig, DltRequest, Env, SMS_KINDS, SmsMessage, buildDltRequest, smsFlag } from './core/sms-core';
import { mailError } from './mail.errors';
import { PhoneCodeSender } from './identity-otp.sender';
import { SmsSettingsService } from './settings/sms-settings';

/**
 * SMS (Amendment 12 Q7). SmsPort is what the rest of the code calls; GuardedSmsPort is the one implementation and puts every rule in front of the provider: the kind must be on the closed transactional
 * list, the number an Indian mobile, the DLT entity id, sender id and an APPROVED template of that kind must be set in settings, the text is the template with its values in place, and the flag
 * SMS_LIVE_SEND must be ON (default OFF). The provider sits behind SmsTransport. No provider has been chosen, so the product binding is UnboundSmsTransport, which refuses.
 */
export abstract class SmsPort { abstract send(m: SmsMessage): Promise<void> }
export abstract class SmsTransport { abstract deliver(r: DltRequest): Promise<void> }

/** Until the owner picks an SMS provider this refuses (nothing is pretended). The adapter for the chosen provider replaces it. */
export class UnboundSmsTransport extends SmsTransport { async deliver(): Promise<void> { throw mailError(503, 'SMS_NOT_CONFIGURED', 'Text messages are not switched on yet.'); } }
export class FakeSmsTransport extends SmsTransport {
  sent: DltRequest[] = []; failNext = false;
  async deliver(r: DltRequest): Promise<void> { if (this.failNext) { this.failNext = false; throw new Error('provider down'); } this.sent.push(r); }
}

@Injectable()
export class GuardedSmsPort extends SmsPort {
  constructor(private readonly transport: SmsTransport, private readonly settings: SmsSettingsService, @Optional() private readonly env: () => Env = () => process.env) { super(); }
  async send(m: SmsMessage): Promise<void> {
    const s = await this.settings.get();
    const cfg: DltConfig | null = s.smsPrincipalEntityId && s.smsSenderId && s.smsTemplates ? { principalEntityId: s.smsPrincipalEntityId, senderId: s.smsSenderId, templates: s.smsTemplates } : null;
    if (!(SMS_KINDS as readonly string[]).includes(m.kind)) throw mailError(400, 'SMS_KIND_FORBIDDEN', 'That kind of message cannot be sent by SMS.');
    if (!cfg) throw mailError(503, 'SMS_NOT_CONFIGURED', 'Text messages are not switched on yet.');
    const built = buildDltRequest(cfg, m);
    if (!built.ok) throw mailError(400, built.problem.code, built.problem.message);
    if (!smsFlag(this.env())) throw mailError(503, 'SMS_NOT_LIVE', 'Text messages are not switched on yet.');
    try { await this.transport.deliver(built.req); } catch (e) { throw (e as { response?: { code?: string } }).response?.code ? e : mailError(502, 'SMS_FAILED', 'The message could not be sent right now.'); }
  }
}

/** The phone side of identity codes: the template key IDENTITY_OTP with the code as its one value. */
@Injectable()
export class SmsPhoneCodeSender extends PhoneCodeSender {
  constructor(private readonly sms: SmsPort) { super(); }
  async sendCode(to: string, code: string): Promise<void> { await this.sms.send({ kind: 'OTP', to, templateKey: 'IDENTITY_OTP', vars: [code] }); }
}
