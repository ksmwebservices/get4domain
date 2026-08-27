import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { SmsService } from '../sms/sms.service';
import { WalletService } from '../wallet/wallet.service';
import { VendorCommsService } from '../vendor-comms/vendor-comms.service';

export type Channel = 'whatsapp' | 'email' | 'sms';

// Per-message wallet rate keys (pricing category) + fallback in paise. Vendors
// are debited only for REAL sends — never for mock (unconfigured) sends.
const CHANNEL_RATE: Record<Channel, { key: string; fallbackPaise: number }> = {
  sms: { key: 'sms_message', fallbackPaise: 50 },
  whatsapp: { key: 'whatsapp_message', fallbackPaise: 100 },
  email: { key: 'email_message', fallbackPaise: 20 },
};

export interface SendResult {
  channel: Channel;
  status: string;
  mock: boolean;
  providerMessageId?: string;
}

@Injectable()
export class CommunicationService {
  private readonly logger = new Logger(CommunicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly whatsapp: WhatsappService,
    private readonly sms: SmsService,
    private readonly wallet: WalletService,
    private readonly commsSettings: VendorCommsService,
  ) {}

  /**
   * Unified send. Email is REAL (Resend); WhatsApp/SMS go via Fast2SMS once
   * configured (mock until then). Usage is debited from the vendor's wallet
   * per message — but only for REAL (non-mock) sends, never for mock sends.
   */
  async send(
    vendorId: string,
    channel: Channel,
    to: string,
    message: string,
    subject?: string,
    contactId?: string,
  ): Promise<SendResult> {
    const rate = CHANNEL_RATE[channel];
    const cost = await this.wallet.getRate(rate.key, rate.fallbackPaise);

    // Fail before sending a paid message if the wallet can't cover it.
    if (cost > 0 && !(await this.wallet.hasSufficientBalance(vendorId, cost))) {
      throw new BadRequestException('INSUFFICIENT_WALLET_BALANCE');
    }

    // The vendor's own communication identity, layered over the platform defaults.
    // Resolved here (not inside the providers) so the shared Fast2SMS / Resend
    // services stay tenant-agnostic — see VendorCommsService.resolveBranding.
    const branding = await this.commsSettings.resolveBranding(vendorId);

    let result: SendResult;
    if (channel === 'email') {
      await this.email.sendGeneric(
        to,
        subject ?? `Message from ${branding.emailFromName}`,
        `<p>${message}</p>`,
        { fromName: branding.emailFromName, replyTo: branding.emailReplyTo },
      );
      result = { channel, status: 'sent', mock: false };
    } else if (channel === 'whatsapp') {
      // A vendor who has switched their WhatsApp channel off should not be billed
      // for a send they did not intend — fail loudly instead of sending silently.
      if (!branding.waEnabled) throw new BadRequestException('WHATSAPP_CHANNEL_DISABLED');
      const r = await this.whatsapp.sendMessage(
        to,
        message,
        branding.waTemplateId ?? undefined,
        branding.waPhoneNumberId ?? undefined,
      );
      result = { channel, status: r.status, mock: r.mock, providerMessageId: r.providerMessageId };
    } else {
      const r = await this.sms.sendSms(to, message, branding.smsBusinessName);
      result = { channel, status: r.status, mock: r.mock, providerMessageId: r.providerMessageId };
    }

    // Charge only for a confirmed real send — never for mock (no key) or failed.
    if (cost > 0 && result.status === 'sent') {
      await this.wallet.deduct(vendorId, cost, `${channel.toUpperCase()} message sent`, `comm_${channel}`);
    }

    // Persist to the inbox history (outbound). Best-effort — never fail the send.
    try {
      await this.prisma.message.create({
        data: {
          vendorId,
          contactId: contactId ?? null,
          channel,
          direction: 'out',
          subject: subject ?? null,
          body: message,
          status: result.status,
          providerMessageId: result.providerMessageId ?? null,
        },
      });
    } catch { /* history is best-effort */ }

    return result;
  }

  /** Persisted message history for one contact + channel (the real inbox thread). */
  async history(vendorId: string, contactId: string, channel?: Channel) {
    return this.prisma.message.findMany({
      where: { vendorId, contactId, ...(channel ? { channel } : {}) },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
  }

  /**
   * Conversation list (unified inbox): the vendor's contacts, each showing their
   * most recent PERSISTED message (falls back to the contact's notes if none yet).
   * Inbound messages will appear here once provider webhooks are wired (future).
   */
  async threads(vendorId: string): Promise<{ contactId: string; name: string; phone: string; email: string | null; lastMessage: string }[]> {
    const [contacts, recent] = await Promise.all([
      this.prisma.contact.findMany({ where: { vendorId }, orderBy: { updatedAt: 'desc' }, take: 50 }),
      this.prisma.message.findMany({ where: { vendorId, contactId: { not: null } }, orderBy: { createdAt: 'desc' }, take: 300 }),
    ]);
    const lastByContact = new Map<string, string>();
    for (const m of recent) {
      if (m.contactId && !lastByContact.has(m.contactId)) lastByContact.set(m.contactId, m.body);
    }
    return contacts.map((c) => ({
      contactId: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      lastMessage: lastByContact.get(c.id) ?? c.notes ?? '',
    }));
  }
}
