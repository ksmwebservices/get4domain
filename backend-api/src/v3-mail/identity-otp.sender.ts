import { Injectable } from '@nestjs/common';
import { IdentityOtpSender } from '../v3-registrar/identity.service';
import { EmailPort } from './email.port';

/** The phone side of the one-time code. Bound to the SMS port in the SMS slice; until then it refuses. (Declared before its user: the decorator metadata names it at class definition.) */
export abstract class PhoneCodeSender { abstract sendCode(to: string, code: string, vendorId: string): Promise<void> }
export const OTP_NOT_CONNECTED = 'OTP_DELIVERY_NOT_CONNECTED';   // an internal message the identity service maps itself; never an HTTP code
export class NoPhoneCodeSender extends PhoneCodeSender { async sendCode(): Promise<void> { throw new Error(OTP_NOT_CONNECTED); } }

/**
 * Delivers the identity one-time codes (the sender that Batch 11 left unconnected). Email goes out on lane 1 (kind OTP, flag EMAIL_LIVE_SEND, default OFF: a switched-off lane makes the code
 * unusable and the caller says so). The text carries the code only: no promotion, and no timeframe. The phone channel is connected with the SMS port.
 */
@Injectable()
export class ChannelIdentityOtpSender extends IdentityOtpSender {
  constructor(private readonly email: EmailPort, private readonly phone: PhoneCodeSender) { super(); }
  async send(channel: 'EMAIL' | 'PHONE', to: string, code: string, vendorId: string): Promise<void> {
    if (channel === 'EMAIL') { await this.email.send({ lane: 'SYSTEM', kind: 'OTP', to, subject: 'Your Get4Domain verification code', text: `Your Get4Domain verification code is ${code}.\n\nIf you did not ask for it, you can ignore this message.` }); return; }
    await this.phone.sendCode(to, code, vendorId);
  }
}
