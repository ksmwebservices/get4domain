import { Injectable, Logger } from '@nestjs/common';
import { WhatsappTemplate } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { hashOf, maskPhone, normalizePhone } from '../../leadspace/leadspace.types';
import { CloudApiWhatsappProvider } from './cloud-api.provider';
import { SandboxWhatsappProvider } from './sandbox.provider';
import { DeliveryStatus, TemplateCategory, WhatsappProvider } from './whatsapp-provider';

export const DEFAULT_TEMPLATES: { name: string; category: TemplateCategory; body: string }[] = [
  { name: 'leadspace_otp', category: 'AUTHENTICATION', body: '{{1}} is your verification code. It is valid for 5 minutes. Do not share this code with anyone.' },
  { name: 'leadspace_new_lead', category: 'UTILITY', body: 'New {{1}} for {{2}}: {{3}}, {{4}}. Tap to chat with the customer: {{5}}' },
  { name: 'leadspace_held_leads', category: 'UTILITY', body: '{{1}} new customer(s) are waiting for {{2}}. Refill your LeadSpace wallet to see their details: {{3}}' },
  { name: 'leadspace_low_balance', category: 'UTILITY', body: 'Your LeadSpace wallet for {{1}} is low: {{2}} left. Refill to keep receiving customers: {{3}}' },
  { name: 'leadspace_refill_receipt', category: 'UTILITY', body: 'Thank you. {{1}} was added to the LeadSpace wallet of {{2}}. Your tax invoice {{3}} has been e-mailed.' },
];

/** Marketing-style words that may never appear in a template body or a variable sent from the common number. */
const PROMO = /\b(offer|discount|sale|% ?off|free gift|limited time|buy now|deal of|cashback|coupon)\b/i;

export interface GatewaySend { template: string; phone: string; variables: string[]; vendorId?: string | null }
export interface GatewayResult { status: DeliveryStatus | 'REFUSED'; providerMessageId?: string; reason?: string }

/**
 * The only door to the common Get4Domain WhatsApp number. The rules are enforced here, in code, not in policy documents:
 *   1 only AUTHENTICATION and UTILITY templates exist in the registry; anything else is refused;
 *   2 there is no free-text and no bulk method: one approved template to one customer or vendor at a time;
 *   3 promotional wording in a template or its values is refused;
 *   4 the live provider refuses a template that Meta has not approved (sandbox allows all);
 *   5 a single number gets at most `PER_PHONE_PER_DAY` messages a day;
 *   6 there is no chat relay: inbound messages are logged and dropped, the conversation continues on the vendor's own WhatsApp;
 *   7 every send is logged against its vendor (number masked) so a spammy vendor can be seen and stopped.
 */
@Injectable()
export class WhatsappGatewayService {
  private readonly logger = new Logger(WhatsappGatewayService.name);
  static PER_PHONE_PER_DAY = 12;
  private provider: WhatsappProvider | null = null;

  constructor(private readonly prisma: PrismaService) {}

  setProvider(p: WhatsappProvider): void { this.provider = p; }

  getProvider(): WhatsappProvider {
    if (this.provider) return this.provider;
    const e = process.env;
    if ((e.WHATSAPP_PROVIDER ?? 'sandbox') === 'cloud' && e.WHATSAPP_CLOUD_TOKEN && e.WHATSAPP_PHONE_NUMBER_ID) {
      this.provider = new CloudApiWhatsappProvider({ token: e.WHATSAPP_CLOUD_TOKEN, phoneNumberId: e.WHATSAPP_PHONE_NUMBER_ID, appSecret: e.WHATSAPP_APP_SECRET ?? '', verifyToken: e.WHATSAPP_VERIFY_TOKEN ?? '' });
    } else this.provider = new SandboxWhatsappProvider();
    return this.provider;
  }

  async ensureTemplates(): Promise<void> {
    for (const t of DEFAULT_TEMPLATES) await this.prisma.whatsappTemplate.upsert({ where: { name: t.name }, create: { ...t, approvalStatus: 'SANDBOX' }, update: {} });
  }

  async templates(): Promise<WhatsappTemplate[]> { await this.ensureTemplates(); return this.prisma.whatsappTemplate.findMany({ orderBy: { name: 'asc' } }); }

  async setApproval(name: string, approvalStatus: 'SANDBOX' | 'PENDING' | 'APPROVED' | 'REJECTED', providerTemplateId?: string): Promise<WhatsappTemplate> {
    return this.prisma.whatsappTemplate.update({ where: { name }, data: { approvalStatus, ...(providerTemplateId !== undefined ? { providerTemplateId } : {}) } });
  }

  /** "Live" only when the cloud provider is configured AND the OTP template is approved. Everything else reads Awaiting approval. */
  async liveStatus(): Promise<{ provider: string; sandbox: boolean; status: 'Live' | 'Awaiting approval'; approvedTemplates: number }> {
    await this.ensureTemplates();
    const p = this.getProvider();
    const approved = await this.prisma.whatsappTemplate.count({ where: { approvalStatus: 'APPROVED' } });
    const otp = await this.prisma.whatsappTemplate.findUnique({ where: { name: 'leadspace_otp' } });
    return { provider: p.name, sandbox: p.sandbox, status: !p.sandbox && otp?.approvalStatus === 'APPROVED' ? 'Live' : 'Awaiting approval', approvedTemplates: approved };
  }

  async send(s: GatewaySend): Promise<GatewayResult> {
    await this.ensureTemplates();
    const ten = normalizePhone(s.phone);
    const toMasked = ten ? maskPhone(ten) : 'invalid';
    const hash = ten ? hashOf(`p:${ten}`) : 'invalid';
    const log = (status: string, extra: { providerMessageId?: string; error?: string } = {}) =>
      this.prisma.whatsappMessageLog.create({ data: { provider: this.getProvider().name, template: s.template, toMasked, phoneHash: hash, vendorId: s.vendorId ?? null, status, providerMessageId: extra.providerMessageId ?? null, error: extra.error ?? null } }).catch(() => undefined);
    const refuse = async (reason: string): Promise<GatewayResult> => { await log('REFUSED', { error: reason }); return { status: 'REFUSED', reason }; };

    if (!ten) return refuse('That is not a valid mobile number.');
    const tpl = await this.prisma.whatsappTemplate.findUnique({ where: { name: s.template } });
    if (!tpl || (tpl.category !== 'AUTHENTICATION' && tpl.category !== 'UTILITY')) return refuse('Only approved authentication and utility templates can be sent from the common number.');
    if (PROMO.test(tpl.body) || (tpl.category === 'UTILITY' && s.variables.some((v) => PROMO.test(v)))) return refuse('Promotional wording is not allowed on the common number.');
    const provider = this.getProvider();
    if (!provider.sandbox && tpl.approvalStatus !== 'APPROVED') return refuse('This message template is awaiting approval from WhatsApp.');
    const dayAgo = new Date(Date.now() - 24 * 3_600_000);
    const sentToday = await this.prisma.whatsappMessageLog.count({ where: { phoneHash: hash, createdAt: { gte: dayAgo }, status: { in: ['SENT', 'DELIVERED', 'QUEUED'] } } });
    if (sentToday >= WhatsappGatewayService.PER_PHONE_PER_DAY) return refuse('This number has already received the most messages allowed today.');

    try {
      const r = await provider.sendTemplate({ to: `91${ten}`, template: tpl.name, language: tpl.language, category: tpl.category as TemplateCategory, variables: s.variables, providerTemplateId: tpl.providerTemplateId });
      await log(r.status === 'FAILED' ? 'FAILED' : 'SENT', { providerMessageId: r.providerMessageId });
      return { status: r.status, providerMessageId: r.providerMessageId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'send failed';
      this.logger.warn(`WhatsApp send failed (${s.template}): ${msg}`);
      await log('FAILED', { error: msg });
      return { status: 'FAILED', reason: 'We could not send the WhatsApp message just now.' };
    }
  }

  /** Webhook: delivery updates are recorded; inbound customer messages are logged and dropped (no relay through our number). */
  async handleWebhook(rawBody: Buffer | string, signature: string | undefined, body: unknown): Promise<{ ok: boolean; updates: number; inboundDropped: number }> {
    const p = this.getProvider();
    if (!p.verifySignature(rawBody, signature)) return { ok: false, updates: 0, inboundDropped: 0 };
    const parsed = p.parseWebhook(body);
    let updates = 0;
    for (const s of parsed.statuses) {
      const r = await this.prisma.whatsappMessageLog.updateMany({ where: { providerMessageId: s.providerMessageId }, data: { status: s.status === 'READ' ? 'DELIVERED' : s.status, error: s.error ?? null } });
      updates += r.count;
    }
    return { ok: true, updates, inboundDropped: parsed.inbound.length };
  }

  /** Per vendor: messages sent, refused and failed in the last 24 hours, for spam-rate monitoring. */
  async spamStats(vendorId: string): Promise<{ sent: number; refused: number; failed: number }> {
    const since = new Date(Date.now() - 24 * 3_600_000);
    const rows = await this.prisma.whatsappMessageLog.groupBy({ by: ['status'], where: { vendorId, createdAt: { gte: since } }, _count: true });
    const n = (s: string): number => rows.filter((r) => r.status === s).reduce((a, r) => a + r._count, 0);
    return { sent: n('SENT') + n('DELIVERED'), refused: n('REFUSED'), failed: n('FAILED') };
  }
}
