import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { getIndustryConfig, deriveCustomerPortal } from '../config/industries';

interface OtpEntry { otp: string; expires: number; contactId: string; vendorId: string }
interface CustomerSession { contactId: string; vendorId: string }
interface CustomerJwt { sub: string; vendorId: string; kind: string }

const OTP_TTL_MS = 5 * 60 * 1000;

/**
 * Customer-facing portal auth + data. Sessions are STATELESS JWTs (3A) signed with
 * a customer-specific secret, so they survive restarts/scale and can never be used
 * against vendor routes. Data is real and tenant-scoped (vendorId + contactId). The
 * OTP delivery rides the SmsService provider layer (real when configured).
 */
@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);
  private readonly otps = new Map<string, OtpEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly sms: SmsService,
    private readonly whatsapp: WhatsappService,
  ) {}

  private issueToken(contactId: string, vendorId: string): string {
    return this.jwt.sign({ sub: contactId, vendorId, kind: 'customer' });
  }

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
    const token = this.issueToken(entry.contactId, entry.vendorId);

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
    const token = this.issueToken(contact.id, vendorId);
    return { token, contactName: contact.name };
  }

  private resolve(authHeader?: string): CustomerSession {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Customer session expired');
    try {
      const p = this.jwt.verify<CustomerJwt>(token);
      if (p.kind !== 'customer' || !p.sub || !p.vendorId) throw new Error('bad token');
      return { contactId: p.sub, vendorId: p.vendorId };
    } catch {
      throw new UnauthorizedException('Customer session expired');
    }
  }

  async me(authHeader?: string) {
    const s = this.resolve(authHeader);
    const [contact, vendor] = await Promise.all([
      this.prisma.contact.findUnique({ where: { id: s.contactId } }),
      this.prisma.vendor.findUnique({ where: { id: s.vendorId } }),
    ]);
    const cfg = getIndustryConfig(vendor?.industry);
    return {
      contact: { id: contact?.id, name: contact?.name, phone: contact?.phone, email: contact?.email },
      vendor: { businessName: vendor?.businessName },
      industry: {
        key: cfg.key,
        label: cfg.label,
        record: cfg.entities.record,
        catalogItem: cfg.entities.catalogItem,
        contact: cfg.entities.contact,
      },
      // Per-industry portal shape — which tabs this customer sees and what they
      // are called. Derived from the same config the vendor dashboard reads, so
      // the two sides can never drift apart.
      portal: deriveCustomerPortal(cfg),
    };
  }

  /**
   * The vendor's real catalogue, browsable by a signed-in customer. READ-ONLY —
   * this deliberately exposes no ordering/booking path; customer-initiated
   * writes are separate future work. Only `active` items are returned, and only
   * for the customer's own vendor (tenant scope comes from the session token,
   * never from a client-supplied vendorId).
   */
  async catalog(authHeader?: string) {
    const s = this.resolve(authHeader);
    const items = await this.prisma.catalogItem.findMany({
      where: { vendorId: s.vendorId, active: true },
      orderBy: { name: 'asc' },
    });
    return items.map((i) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      price: i.price,
      unit: i.unit,
      image: i.image,
      // `stock` is nullable = untracked. Surface it only where the vendor
      // actually manages inventory, so the portal can show "Out of stock".
      inStock: i.stock === null ? null : i.stock > 0,
    }));
  }

  /**
   * Reach-the-business details for the portal's contact modal, sourced from the
   * vendor's own CMS record (the same data that powers their public website).
   * Falls back to the Vendor row where CMS fields are blank so the modal is
   * never empty for a vendor who hasn't filled in their site yet.
   */
  async contactDetails(authHeader?: string) {
    const s = this.resolve(authHeader);
    const [vendor, cms] = await Promise.all([
      this.prisma.vendor.findUnique({ where: { id: s.vendorId } }),
      this.prisma.vendorCMS.findUnique({ where: { vendorId: s.vendorId } }),
    ]);
    return {
      businessName: cms?.businessName ?? vendor?.businessName ?? null,
      phone: cms?.phone ?? vendor?.phone ?? null,
      whatsapp: cms?.whatsapp ?? cms?.phone ?? vendor?.phone ?? null,
      email: cms?.email ?? vendor?.email ?? null,
      address: cms?.address ?? null,
      businessHours: cms?.businessHours ?? null,
      mapsLink: cms?.googleMaps ?? null,
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
