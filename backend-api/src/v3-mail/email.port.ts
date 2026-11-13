import { Injectable, Optional } from '@nestjs/common';
import { Resend } from 'resend';
import { Env, OutboundEmail, assertTransactional, flagFor } from './core/mail-core';
import { mailError } from './mail.errors';
import { MailSettingsService } from './settings/mail-settings';

/**
 * Email (Amendment 12 Q3 lane 1). EmailPort is what the rest of the code calls. GuardedEmailPort is the ONE implementation and puts every rule in front of the provider: the kind must be on the closed
 * list of its lane (no promotion, ever), exactly one valid recipient, the flag for that kind must be ON (both default OFF), the sender must be set in settings. Only lane 1 sends in this block:
 * lane 2 is recorded as rules and refuses (Release 2). The provider itself sits behind EmailTransport, so tests bind FakeEmailTransport and never reach Resend.
 */
export abstract class EmailPort { abstract send(m: OutboundEmail): Promise<void> }
export interface EmailSender { address: string; name: string }
export abstract class EmailTransport { abstract deliver(from: EmailSender, m: OutboundEmail): Promise<void> }

export class FakeEmailTransport extends EmailTransport {
  sent: Array<{ from: EmailSender; m: OutboundEmail }> = []; failNext = false;
  async deliver(from: EmailSender, m: OutboundEmail): Promise<void> { if (this.failNext) { this.failNext = false; throw new Error('provider down'); } this.sent.push({ from, m }); }
}

/** Resend, with RESEND_API_KEY from the environment (read on each call, never logged). Never called by a test. */
@Injectable()
export class ResendTransport extends EmailTransport {
  constructor(@Optional() private readonly env: () => Env = () => process.env) { super(); }
  async deliver(from: EmailSender, m: OutboundEmail): Promise<void> {
    const key = this.env().RESEND_API_KEY; if (!key) throw mailError(503, 'EMAIL_NOT_CONFIGURED', 'Email is not switched on yet.');
    const r = await new Resend(key).emails.send({ from: `${from.name} <${from.address}>`, to: [m.to], subject: m.subject, text: m.text, ...(m.replyTo ? { replyTo: m.replyTo } : {}) });
    if (r.error) throw mailError(502, 'EMAIL_FAILED', 'The message could not be sent right now.');
  }
}

@Injectable()
export class GuardedEmailPort extends EmailPort {
  constructor(private readonly transport: EmailTransport, private readonly settings: MailSettingsService, @Optional() private readonly env: () => Env = () => process.env) { super(); }
  async send(m: OutboundEmail): Promise<void> {
    const bad = assertTransactional(m);
    if (bad) throw mailError(400, bad.code, bad.message);
    if (m.lane !== 'SYSTEM' || !flagFor(m.kind, this.env())) throw mailError(503, 'EMAIL_NOT_LIVE', 'Email sending is not switched on yet.');
    const s = await this.settings.get();
    if (!s.mailSystemFromAddress || !s.mailSystemFromName) throw mailError(503, 'EMAIL_NOT_CONFIGURED', 'Email is not switched on yet.');
    try { await this.transport.deliver({ address: s.mailSystemFromAddress, name: m.fromName?.trim() ? `${m.fromName.trim()} via ${s.mailSystemFromName}` : s.mailSystemFromName }, m); }
    catch (e) { throw (e as { response?: { code?: string } }).response?.code ? e : mailError(502, 'EMAIL_FAILED', 'The message could not be sent right now.'); }
  }
}
