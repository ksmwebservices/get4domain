import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { SmsService } from '../sms/sms.service';
import { WalletService } from '../wallet/wallet.service';

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
  ): Promise<SendResult> {
    const rate = CHANNEL_RATE[channel];
    const cost = await this.wallet.getRate(rate.key, rate.fallbackPaise);

    // Fail before sending a paid message if the wallet can't cover it.
    if (cost > 0 && !(await this.wallet.hasSufficientBalance(vendorId, cost))) {
      throw new BadRequestException('INSUFFICIENT_WALLET_BALANCE');
    }

    let result: SendResult;
    if (channel === 'email') {
      await this.email.sendGeneric(to, subject ?? 'Message from your service provider', `<p>${message}</p>`);
      result = { channel, status: 'sent', mock: false };
    } else if (channel === 'whatsapp') {
      const r = await this.whatsapp.sendMessage(to, message);
      result = { channel, status: r.status, mock: r.mock, providerMessageId: r.providerMessageId };
    } else {
      const r = await this.sms.sendSms(to, message);
      result = { channel, status: r.status, mock: r.mock, providerMessageId: r.providerMessageId };
    }

    // Charge only for a confirmed real send — never for mock (no key) or failed.
    if (cost > 0 && result.status === 'sent') {
      await this.wallet.deduct(vendorId, cost, `${channel.toUpperCase()} message sent`, `comm_${channel}`);
    }
    return result;
  }

  /**
   * Conversation list derived from the vendor's contacts (unified inbox). Real
   * message history arrives once provider webhooks are wired; for now each
   * contact is a thread seeded from their stored notes.
   */
  async threads(vendorId: string): Promise<{ contactId: string; name: string; phone: string; email: string | null; lastMessage: string }[]> {
    const contacts = await this.prisma.contact.findMany({
      where: { vendorId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    return contacts.map((c) => ({
      contactId: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      lastMessage: c.notes ?? '',
    }));
  }
}
