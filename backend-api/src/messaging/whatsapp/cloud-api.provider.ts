import * as crypto from 'crypto';
import { DeliveryStatus, ParsedWebhook, SendResult, TemplateMessage, WhatsappProvider, WhatsappSendError } from './whatsapp-provider';

export interface CloudApiConfig {
  token: string;
  phoneNumberId: string;
  appSecret: string;
  verifyToken: string;
  apiVersion?: string;
  /** injectable for tests */
  fetcher?: typeof fetch;
}

const STATUS: Record<string, DeliveryStatus> = { sent: 'SENT', delivered: 'DELIVERED', read: 'READ', failed: 'FAILED' };

/** Meta WhatsApp Cloud API (also what most BSPs expose). Used only once the common number is approved and the credentials are saved. */
export class CloudApiWhatsappProvider implements WhatsappProvider {
  readonly name = 'cloud';
  readonly sandbox = false;
  constructor(private readonly cfg: CloudApiConfig) {}

  async sendTemplate(m: TemplateMessage): Promise<SendResult> {
    const f = this.cfg.fetcher ?? fetch;
    const components: unknown[] = [];
    if (m.variables.length) components.push({ type: 'body', parameters: m.variables.map((text) => ({ type: 'text', text })) });
    // An authentication template carries its one-time code in the copy-code button as well.
    if (m.category === 'AUTHENTICATION' && m.variables[0]) components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: m.variables[0] }] });
    const res = await f(`https://graph.facebook.com/${this.cfg.apiVersion ?? 'v20.0'}/${this.cfg.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: m.to, type: 'template', template: { name: m.providerTemplateId || m.template, language: { code: m.language }, components } }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
    if (!res.ok || !json.messages?.[0]?.id) throw new WhatsappSendError(json.error?.message ?? `WhatsApp refused the message (${res.status})`, res.status >= 500 || res.status === 429);
    return { providerMessageId: json.messages[0].id, status: 'SENT' };
  }

  parseWebhook(body: unknown): ParsedWebhook {
    const out: ParsedWebhook = { statuses: [], inbound: [] };
    const entries = ((body as { entry?: unknown[] })?.entry ?? []) as { changes?: { value?: { statuses?: { id: string; status: string; errors?: { title?: string }[] }[]; messages?: { from: string; id: string; text?: { body?: string } }[] } }[] }[];
    for (const e of entries) for (const c of e.changes ?? []) {
      for (const s of c.value?.statuses ?? []) out.statuses.push({ providerMessageId: s.id, status: STATUS[s.status] ?? 'SENT', error: s.errors?.[0]?.title });
      for (const m of c.value?.messages ?? []) out.inbound.push({ from: m.from, text: m.text?.body, providerMessageId: m.id });
    }
    return out;
  }

  verifySignature(rawBody: Buffer | string, signatureHeader: string | undefined): boolean {
    if (!signatureHeader || !this.cfg.appSecret) return false;
    const expected = `sha256=${crypto.createHmac('sha256', this.cfg.appSecret).update(rawBody).digest('hex')}`;
    return expected.length === signatureHeader.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  }

  verifyHandshake(query: Record<string, string | undefined>): string | null {
    return query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === this.cfg.verifyToken ? (query['hub.challenge'] ?? '') : null;
  }
}
