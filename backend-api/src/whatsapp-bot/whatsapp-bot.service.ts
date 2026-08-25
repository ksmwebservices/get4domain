import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { AiService } from '../ai/ai.service';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import type { Contact, Vendor, WhatsappConversation } from '@prisma/client';

const HANDOFF_RE = /\b(agent|human|representative|talk to (someone|a person)|speak to|call me|customer care)\b/i;
const INTEREST_RE = /\b(price|cost|charges?|rate|book|booking|order|buy|purchase|interested|enquir|appointment|quote|available|availability|how much)\b/i;
const WA_SESSION_RATE_KEY = 'whatsapp_session';
const WA_SESSION_FALLBACK_PAISE = 100; // ₹1 per conversation window (admin-overridable)
const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * WhatsApp lead-qualifying bot orchestrator.
 * Flow per inbound message: route to tenant → persist → (AGENT handoff? name
 * capture?) → KB match first, AI fallback second → reply via session message →
 * capture interest → create/update CRM lead → bill the session per conversation.
 * Mock-first everywhere: replies log instead of send and nothing is billed until
 * the Fast2SMS key is configured, so no real customer/payment data is touched here.
 */
@Injectable()
export class WhatsappBotService {
  private readonly logger = new Logger(WhatsappBotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly ai: AiService,
    private readonly wallet: WalletService,
    private readonly notifications: NotificationsService,
    private readonly kb: KnowledgeBaseService,
  ) {}

  /** Entry point for a verified inbound webhook message. */
  async handleInbound(params: { from?: string; body?: string; phoneNumberId?: string; messageId?: string }): Promise<{ handled: boolean; reason?: string }> {
    const from = (params.from ?? '').replace(/\D/g, '');
    const text = (params.body ?? '').trim();
    if (!from || !text) return { handled: false, reason: 'missing from/body' };

    const vendor = await this.resolveVendor(params.phoneNumberId, from);
    if (!vendor) {
      this.logger.warn(`Inbound WA from ${from} could not be routed to a vendor (phone_number_id=${params.phoneNumberId ?? 'none'})`);
      return { handled: false, reason: 'no vendor match' };
    }

    const contact = await this.getOrCreateContact(vendor.id, from);
    const convo = await this.getOrCreateConversation(vendor.id, from, contact.id, params.phoneNumberId);
    await this.persistMessage(vendor.id, contact.id, 'in', text, params.messageId ?? undefined);

    // Already handed off to a human → stay silent (the inbound is still logged above).
    if (convo.state === 'agent') return { handled: true, reason: 'in agent mode' };

    // AGENT handoff request at any point.
    if (HANDOFF_RE.test(text)) {
      await this.prisma.whatsappConversation.update({ where: { id: convo.id }, data: { state: 'agent' } });
      await this.ensureLead(vendor.id, convo, contact, text || 'Requested a human agent');
      await this.notifyVendor(vendor.id, contact, 'WhatsApp: customer asked for a human', `${contact.name || from} asked to talk to your team on WhatsApp.`);
      await this.reply(vendor, convo, `Sure — someone from ${vendor.businessName} will follow up with you shortly. 🙏`);
      return { handled: true, reason: 'handoff' };
    }

    // We previously asked for the name → treat this message as the name.
    if (convo.state === 'awaiting_name') {
      const name = this.extractName(text);
      await this.prisma.contact.update({ where: { id: contact.id }, data: { name } });
      await this.prisma.whatsappConversation.update({ where: { id: convo.id }, data: { state: 'active', nameCaptured: true } });
      await this.ensureLead(vendor.id, { ...convo, nameCaptured: true }, { ...contact, name }, 'Interested (captured via WhatsApp bot)');
      await this.reply(vendor, convo, `Thanks ${name}! 🙌 Our team will reach out to you shortly. Meanwhile, feel free to ask anything.`);
      return { handled: true, reason: 'name captured' };
    }

    // Answer: knowledge base FIRST, AI fallback only if no KB match.
    let answer: string;
    const kbHit = await this.kb.match(vendor.id, text);
    if (kbHit) {
      answer = kbHit.answer;
    } else {
      answer = await this.aiFallback(vendor, contact.id, text);
    }

    // Interest + no name yet → ask for the name (phone already known from webhook).
    const interested = INTEREST_RE.test(text);
    let askedName = false;
    if (interested && !convo.nameCaptured) {
      answer = `${answer}\n\nMay I have your name so our team can assist you better?`;
      askedName = true;
    } else if (interested && convo.nameCaptured) {
      await this.ensureLead(vendor.id, convo, contact, text);
    }

    await this.reply(vendor, convo, answer);
    if (askedName) {
      await this.prisma.whatsappConversation.update({ where: { id: convo.id }, data: { state: 'awaiting_name' } });
    }
    return { handled: true };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private async resolveVendor(phoneNumberId: string | undefined, phone: string): Promise<Vendor | null> {
    if (phoneNumberId) {
      const byNumber = await this.prisma.vendor.findUnique({ where: { waPhoneNumberId: phoneNumberId } });
      if (byNumber) return byNumber;
    }
    // Fall back to an existing conversation for this phone (handles missing id).
    const convo = await this.prisma.whatsappConversation.findFirst({ where: { phone } });
    if (convo) return this.prisma.vendor.findUnique({ where: { id: convo.vendorId } });
    return null;
  }

  private async getOrCreateContact(vendorId: string, phone: string): Promise<Contact> {
    const existing = await this.prisma.contact.findFirst({ where: { vendorId, phone } });
    if (existing) return existing;
    return this.prisma.contact.create({ data: { vendorId, phone, name: `WhatsApp ${phone.slice(-4)}`, type: 'lead' } });
  }

  private async getOrCreateConversation(vendorId: string, phone: string, contactId: string, phoneNumberId?: string): Promise<WhatsappConversation> {
    const existing = await this.prisma.whatsappConversation.findUnique({ where: { vendorId_phone: { vendorId, phone } } });
    if (existing) {
      if (!existing.contactId) {
        return this.prisma.whatsappConversation.update({ where: { id: existing.id }, data: { contactId } });
      }
      return existing;
    }
    return this.prisma.whatsappConversation.create({ data: { vendorId, phone, contactId, phoneNumberId: phoneNumberId ?? null } });
  }

  private persistMessage(vendorId: string, contactId: string, direction: 'in' | 'out', body: string, providerMessageId?: string, status = 'received') {
    return this.prisma.message.create({
      data: { vendorId, contactId, channel: 'whatsapp', direction, body, status, providerMessageId: providerMessageId ?? null },
    }).catch(() => null); // transcript is best-effort — never fail the webhook
  }

  /** Send a bot reply, persist it, and bill the session once per 24h conversation window. */
  private async reply(vendor: Vendor, convo: WhatsappConversation, text: string): Promise<void> {
    const res = await this.whatsapp.sendSessionMessage(convo.phone, text, convo.phoneNumberId ?? undefined);
    if (convo.contactId) await this.persistMessage(vendor.id, convo.contactId, 'out', text, res.providerMessageId, res.status);

    // Bill per CONVERSATION window, not per message — and only for a confirmed real
    // send (never mock/failed), so mock mode debits nothing.
    if (res.status !== 'sent') return;
    const now = Date.now();
    const fresh = await this.prisma.whatsappConversation.findUnique({ where: { id: convo.id } });
    const windowStart = fresh?.windowStart?.getTime() ?? 0;
    if (now - windowStart > WINDOW_MS) {
      const cost = await this.wallet.getRate(WA_SESSION_RATE_KEY, WA_SESSION_FALLBACK_PAISE);
      if (cost > 0 && (await this.wallet.hasSufficientBalance(vendor.id, cost))) {
        await this.wallet.deduct(vendor.id, cost, 'WhatsApp bot conversation', 'whatsapp_session');
      }
      await this.prisma.whatsappConversation.update({ where: { id: convo.id }, data: { windowStart: new Date(now) } });
    }
  }

  private async aiFallback(vendor: Vendor, contactId: string, message: string): Promise<string> {
    try {
      const [context, history] = await Promise.all([this.kb.buildContext(vendor.id), this.recentHistory(vendor.id, contactId)]);
      return await this.ai.whatsappBotReply({ businessName: vendor.businessName, context, history, message });
    } catch {
      // AI not configured (mock/dev) or unavailable → graceful escalation, no guess.
      return `Thanks for your message! Our team at ${vendor.businessName} will get back to you shortly.`;
    }
  }

  private async recentHistory(vendorId: string, contactId: string): Promise<string> {
    const msgs = await this.prisma.message.findMany({
      where: { vendorId, contactId, channel: 'whatsapp' },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });
    return msgs.reverse().map((m) => `${m.direction === 'in' ? 'Customer' : 'You'}: ${m.body}`).join('\n');
  }

  /** Create the CRM lead once, then keep it updated. Linked to the Contact so the
   *  full WhatsApp transcript is reachable from TeleCRM. */
  private async ensureLead(vendorId: string, convo: WhatsappConversation, contact: Contact, message: string): Promise<void> {
    if (convo.leadId) {
      await this.prisma.campaignLead.updateMany({ where: { id: convo.leadId, vendorId }, data: { name: contact.name, message } });
      return;
    }
    const lead = await this.prisma.campaignLead.create({
      data: {
        vendorId,
        contactId: contact.id,
        name: contact.name,
        phone: contact.phone,
        message,
        source: 'whatsapp_bot',
        status: 'new',
        notes: 'Captured by the WhatsApp bot — see the full conversation in Communication Hub.',
      },
    });
    await this.prisma.whatsappConversation.update({ where: { id: convo.id }, data: { leadId: lead.id } });
    await this.notifyVendor(vendorId, contact, 'New WhatsApp lead', `${contact.name} enquired on WhatsApp: "${message.slice(0, 80)}"`);
  }

  private async notifyVendor(vendorId: string, contact: Contact, title: string, msg: string): Promise<void> {
    try {
      await this.notifications.notifyVendor(vendorId, 'whatsapp_bot', title, msg, { data: { link: '/dashboard/telecrm' } });
    } catch { /* notification is best-effort */ }
  }

  private extractName(text: string): string {
    const cleaned = text.replace(/^(my name is|i am|i'm|this is|name[:-]?)\s*/i, '').trim();
    const name = (cleaned || text).split(/[\n.,]/)[0].trim().slice(0, 60);
    return name || 'WhatsApp Lead';
  }
}
