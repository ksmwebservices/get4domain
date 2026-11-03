import { randomUUID } from 'crypto';
import { EmailService } from '../../email/email.service';
import { StepError } from '../provisioning.errors';

/**
 * How an invite leaves the platform. Two modes (docs/v3/V3_S3_PROVISIONING.md section 5):
 *  - sandbox (the default everywhere): nothing is sent. The step records the message in the database so staff and tests can read it.
 *  - live: exists, is OFF. It refuses to run unless the environment variable V3_INVITE_LIVE_ENABLED is exactly "true", which nobody has set. Even when the
 *    plan setting inviteAdapterMode says "live", without that flag every send fails permanently with LIVE_DISABLED.
 * Tests use the sandbox adapter only; the live adapter is tested with a double.
 */
export interface OutboundEmail { to: string; subject: string; text: string }
export interface SendResult { providerMessageId: string | null }

export abstract class EmailAdapter {
  abstract readonly mode: 'sandbox' | 'live';
  abstract send(message: OutboundEmail): Promise<SendResult>;
}

export class SandboxEmailAdapter extends EmailAdapter {
  readonly mode = 'sandbox' as const;
  async send(_message: OutboundEmail): Promise<SendResult> {
    return { providerMessageId: `sandbox-${randomUUID()}` };
  }
}

export const LIVE_FLAG = 'V3_INVITE_LIVE_ENABLED';

export class LiveEmailAdapter extends EmailAdapter {
  readonly mode = 'live' as const;
  constructor(private readonly mail: Pick<EmailService, 'sendPlainText'>, private readonly env: Record<string, string | undefined> = process.env) { super(); }

  async send(m: OutboundEmail): Promise<SendResult> {
    if (this.env[LIVE_FLAG] !== 'true') throw new StepError('LIVE_DISABLED', false);
    try {
      await this.mail.sendPlainText(m.to, m.subject, m.text);
    } catch (e) {
      // the provider's own message can echo an address or a key; only a fixed code leaves this function
      if (e instanceof StepError) throw e;
      throw new StepError('ADAPTER_TIMEOUT', true);
    }
    return { providerMessageId: null };   // the mail service does not return the provider's message id
  }
}

export function selectEmailAdapter(mode: 'sandbox' | 'live', mail: Pick<EmailService, 'sendPlainText'>, env?: Record<string, string | undefined>): EmailAdapter {
  return mode === 'live' ? new LiveEmailAdapter(mail, env) : new SandboxEmailAdapter();
}
