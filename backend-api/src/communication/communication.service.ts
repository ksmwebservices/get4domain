import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { SmsService } from '../sms/sms.service';

export type Channel = 'whatsapp' | 'email' | 'sms';

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
  ) {}

  /**
   * Unified send. Email is REAL (Resend); WhatsApp/SMS use the mock provider
   * layer until BSP/gateway credentials are configured.
   */
  async send(
    vendorId: string,
    channel: Channel,
    to: string,
    message: string,
    subject?: string,
  ): Promise<SendResult> {
    if (channel === 'email') {
      await this.email.sendGeneric(to, subject ?? 'Message from your service provider', `<p>${message}</p>`);
      return { channel, status: 'sent', mock: false };
    }
    if (channel === 'whatsapp') {
      const r = await this.whatsapp.sendMessage(to, message);
      return { channel, status: r.status, mock: r.mock, providerMessageId: r.providerMessageId };
    }
    const r = await this.sms.sendSms(to, message);
    return { channel, status: r.status, mock: r.mock, providerMessageId: r.providerMessageId };
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
