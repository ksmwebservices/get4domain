import * as crypto from 'crypto';
import { ParsedWebhook, SendResult, TemplateMessage, WhatsappProvider } from './whatsapp-provider';

export interface SandboxMessage extends TemplateMessage { providerMessageId: string; at: Date }

/**
 * Sandbox provider: nothing leaves the machine. Messages are kept in an outbox so tests (and KSM, in the admin screen) can read the one-time code
 * that would have been sent. Used until Meta approves the common number and whenever WHATSAPP_PROVIDER is not "cloud".
 */
export class SandboxWhatsappProvider implements WhatsappProvider {
  readonly name = 'sandbox';
  readonly sandbox = true;
  readonly outbox: SandboxMessage[] = [];
  secret = 'sandbox-secret';

  async sendTemplate(message: TemplateMessage): Promise<SendResult> {
    const providerMessageId = `sandbox_${crypto.randomBytes(8).toString('hex')}`;
    this.outbox.push({ ...message, providerMessageId, at: new Date() });
    if (this.outbox.length > 500) this.outbox.shift();
    return { providerMessageId, status: 'SENT' };
  }

  parseWebhook(body: unknown): ParsedWebhook {
    const b = (body ?? {}) as { statuses?: { id: string; status: string }[]; messages?: { from: string; text?: string; id: string }[] };
    return {
      statuses: (b.statuses ?? []).map((s) => ({ providerMessageId: s.id, status: (s.status.toUpperCase() as 'SENT') })),
      inbound: (b.messages ?? []).map((m) => ({ from: m.from, text: m.text, providerMessageId: m.id })),
    };
  }

  verifySignature(rawBody: Buffer | string, signatureHeader: string | undefined): boolean {
    if (!signatureHeader) return false;
    const expected = `sha256=${crypto.createHmac('sha256', this.secret).update(rawBody).digest('hex')}`;
    return expected.length === signatureHeader.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  }

  verifyHandshake(query: Record<string, string | undefined>): string | null {
    return query['hub.verify_token'] === 'sandbox-verify' ? (query['hub.challenge'] ?? '') : null;
  }

  /** Test helper: the newest message to a number. */
  lastTo(to: string): SandboxMessage | undefined {
    return [...this.outbox].reverse().find((m) => m.to.endsWith(to.slice(-10)));
  }
}
