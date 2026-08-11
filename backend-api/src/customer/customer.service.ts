import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { getIndustryConfig } from '../config/industries';

interface OtpEntry { otp: string; expires: number; contactId: string; vendorId: string }
interface Session { contactId: string; vendorId: string; expires: number }

const OTP_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Customer-facing portal auth + data. MOCK OTP (returned in dev, logged) until
 * the SMS gateway is live. Sessions are in-memory opaque tokens — acceptable
 * for the mock portal; swap for a persisted/JWT session when going live.
 */
@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);
  private readonly otps = new Map<string, OtpEntry>();
  private readonly sessions = new Map<string, Session>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly whatsapp: WhatsappService,
  ) {}

  async requestOtp(phone: string): Promise<{ sent: boolean; contactExists: boolean; devOtp?: string }> {
    const contact = await this.prisma.contact.findFirst({ where: { phone } });
    if (!contact) {
      // Do not reveal existence in prod; still return sent:true shape.
      return { sent: true, contactExists: false };
    }
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    this.otps.set(phone, { otp, expires: Date.now() + OTP_TTL_MS, contactId: contact.id, vendorId: contact.vendorId });

    // TODO: real SMS send once gateway configured.
    await this.sms.sendSms(phone, `Your login OTP is ${otp}`);
    this.logger.log(`[MOCK] OTP for ${phone}: ${otp}`);

    const isProd = process.env.NODE_ENV === 'production';
    return { sent: true, contactExists: true, ...(isProd ? {} : { devOtp: otp }) };
  }

  async verify(phone: string, otp: string): Promise<{ token: string; contact: { id: string; name: string }; industry: { key: string; label: string } }> {
    const entry = this.otps.get(phone);
    if (!entry || entry.otp !== otp || entry.expires < Date.now()) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    this.otps.delete(phone);
    const token = crypto.randomBytes(24).toString('hex');
    this.sessions.set(token, { contactId: entry.contactId, vendorId: entry.vendorId, expires: Date.now() + SESSION_TTL_MS });

    const contact = await this.prisma.contact.findUnique({ where: { id: entry.contactId } });
    const vendor = await this.prisma.vendor.findUnique({ where: { id: entry.vendorId } });
    const cfg = getIndustryConfig(vendor?.industry);
    return {
      token,
      contact: { id: contact!.id, name: contact!.name },
      industry: { key: cfg.key, label: cfg.label },
    };
  }

  /**
   * Book-Demo Phase 4: seat a customer-portal session for a seeded contact of a
   * sandbox vendor, so the tour can show the customer side without a real OTP
   * login. Same opaque-token session as verify(); scoped to the sandbox vendorId.
   */
  async createSandboxSession(vendorId: string): Promise<{ token: string; contactName: string } | null> {
    const contact = await this.prisma.contact.findFirst({
      where: { vendorId },
      orderBy: { createdAt: 'asc' },
    });
    if (!contact) return null;
    const token = crypto.randomBytes(24).toString('hex');
    this.sessions.set(token, { contactId: contact.id, vendorId, expires: Date.now() + SESSION_TTL_MS });
    return { token, contactName: contact.name };
  }

  private resolve(authHeader?: string): Session {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const session = token ? this.sessions.get(token) : undefined;
    if (!session || session.expires < Date.now()) {
      throw new UnauthorizedException('Customer session expired');
    }
    return session;
  }

  async me(authHeader?: string) {
    const s = this.resolve(authHeader);
    const contact = await this.prisma.contact.findUnique({ where: { id: s.contactId } });
    const vendor = await this.prisma.vendor.findUnique({ where: { id: s.vendorId } });
    const cfg = getIndustryConfig(vendor?.industry);
    return {
      contact: { id: contact?.id, name: contact?.name, phone: contact?.phone, email: contact?.email },
      vendor: { businessName: vendor?.businessName },
      industry: { key: cfg.key, label: cfg.label, record: cfg.entities.record, contact: cfg.entities.contact },
    };
  }

  async records(authHeader?: string) {
    const s = this.resolve(authHeader);
    return this.prisma.record.findMany({
      where: { vendorId: s.vendorId, contactId: s.contactId },
      orderBy: { date: 'desc' },
      include: { catalogItem: true },
    });
  }

  async invoices(authHeader?: string) {
    const s = this.resolve(authHeader);
    return this.prisma.genericInvoice.findMany({
      where: { vendorId: s.vendorId, contactId: s.contactId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Vendor sends a portal invite to a contact (mock WhatsApp + SMS). */
  async invite(vendorId: string, contactId: string): Promise<{ sent: boolean; mock: boolean }> {
    const contact = await this.prisma.contact.findFirst({ where: { id: contactId, vendorId } });
    if (!contact) {
      throw new UnauthorizedException('Contact not found');
    }
    const url = `${process.env.FRONTEND_URL ?? 'https://get4domain.com'}/customer`;
    const msg = `Hi ${contact.name}, access your account portal here: ${url}`;
    const wa = await this.whatsapp.sendMessage(contact.phone, msg);
    await this.sms.sendSms(contact.phone, msg);
    await this.prisma.contact.update({ where: { id: contactId }, data: { portalAccess: true } });
    return { sent: true, mock: wa.mock };
  }
}
