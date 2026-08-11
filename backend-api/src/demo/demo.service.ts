import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { Vendor } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { WalletService } from '../wallet/wallet.service';
import { PaymentsService } from '../payments/payments.service';
import { InvoicesService } from '../invoices/invoices.service';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../email/email.service';
import { SmsService } from '../sms/sms.service';
import { ConfirmBuyDto } from './dto/demo.dto';
import { getIndustryConfig } from '../config/industries';
import { DEMO_CONTENT, buildFallback, NAME_POOL, DemoContent, getSectionMeta } from './demo-content';

type SiteSection =
  | { type: 'catalog'; label: string; items: { name: string; price: number; desc: string }[] }
  | { type: 'team'; label: string; members: { name: string; role: string }[] }
  | { type: 'booking'; label: string; records: { title: string; when: string; status: string }[] }
  | { type: 'reviews'; label: string; items: { name: string; text: string }[] }
  | { type: 'about'; label: string; text: string }
  | { type: 'contact'; label: string };

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly wallet: WalletService,
    private readonly payments: PaymentsService,
    private readonly invoices: InvoicesService,
    private readonly auth: AuthService,
    private readonly email: EmailService,
    private readonly sms: SmsService,
  ) {}

  /** Phase 5 — create a Razorpay order for the ₹6,999/yr go-live upgrade of a sandbox. */
  async createBuyOrder(vendorId: string): Promise<{ orderId: string; amount: number; currency: string }> {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor || !vendor.isSandbox) throw new BadRequestException('No active demo sandbox to upgrade');
    const amount = await this.wallet.getRate('domainapp_annual', 699900); // paise
    const order = await this.payments.createOrder({ amount, currency: 'INR', receipt: `golive_${vendorId}_${Date.now()}` });
    return { orderId: order.id, amount: Number(order.amount), currency: order.currency };
  }

  /**
   * Phase 5 & 6 — on verified payment, CONVERT the sandbox row in place (no delete/
   * recreate): flip isSandbox off, clear expiry, attach the real profile + password.
   * Then (Phase 6, automatic): create the subscription, the paid GST invoice (shared
   * path), grant the Pro AI-Studio credit, and email/SMS "your account is live".
   * A bad signature throws BEFORE any conversion, so an abandoned/failed payment
   * leaves the sandbox untouched (it still expires normally).
   */
  async convertSandbox(vendorId: string, dto: ConfirmBuyDto): Promise<{ token: string; vendorId: string }> {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor || !vendor.isSandbox) throw new BadRequestException('This demo session is no longer available');

    if (!this.payments.verifySignature(dto.razorpayOrderId, dto.razorpayPaymentId, dto.razorpaySignature)) {
      throw new BadRequestException('Payment verification failed'); // sandbox left untouched
    }

    const clash = await this.prisma.vendor.findFirst({ where: { email: dto.email, id: { not: vendorId } } });
    if (clash) throw new BadRequestException('That email is already registered — please use another or log in.');

    const hashed = await AuthService.hashPassword(dto.password);
    const converted = await this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        isSandbox: false,
        expiresAt: null,
        businessName: dto.businessName,
        email: dto.email,
        name: dto.name || vendor.name,
        phone: dto.phone || vendor.phone,
        password: hashed,
      },
    });

    const now = new Date();
    const end = new Date(now); end.setFullYear(end.getFullYear() + 1);
    const amount = await this.wallet.getRate('domainapp_annual', 699900);
    const sub = await this.prisma.subscription.create({
      data: { vendorId, product: 'DOMAIN_APP', plan: 'STARTUP', amount, status: 'ACTIVE', startDate: now, endDate: end },
    });

    // Phase 6 automation — all best-effort; conversion already succeeded.
    try {
      await this.invoices.createPaidInvoice({
        vendorId, paidPaise: amount, description: 'DomainApp Annual Subscription (₹6,999/year)',
        paymentMode: 'Razorpay', source: 'subscription', paymentId: dto.razorpayPaymentId,
        subscriptionId: sub.id, nextRenewal: end,
      });
    } catch (e) { this.logger.error(`Signup invoice failed for ${vendorId}: ${e instanceof Error ? e.message : 'unknown'}`); }
    try {
      const proCredit = await this.wallet.getRate('pro_free_credit', 99900); // ₹999
      await this.wallet.grantCredit(vendorId, proCredit, 'Pro plan AI Studio credit', 'pro_credit');
    } catch { /* best-effort */ }
    try { await this.email.sendWelcomeEmail(converted, dto.password); } catch { /* best-effort */ }
    try { await this.sms.sendSms(converted.phone ?? dto.phone ?? '', 'Your Get4Domain account is live! Log in at get4domain.com/login'); } catch { /* best-effort */ }

    this.logger.log(`Sandbox ${vendorId} converted to a live vendor (subscription ${sub.id})`);
    return { token: this.auth.mintVendorToken(vendorId, converted.email), vendorId };
  }

  /** Multi-section industry website payload (Phase 2): hero + navigable sections. */
  getSite(industryKey: string) {
    const config = getIndustryConfig(industryKey);
    const content = this.resolveContent(config.key);
    return {
      key: config.key,
      label: config.label,
      icon: config.icon,
      entities: config.entities,
      business: content.business,
      tagline: content.tagline,
      about: content.about,
      sections: this.buildSections(config.key, content),
    };
  }

  /** Assemble the ordered, navigable sections for an industry's demo site. */
  private buildSections(key: string, content: DemoContent): SiteSection[] {
    const config = getIndustryConfig(key);
    const meta = getSectionMeta(config.key);
    const statuses = config.recordStatuses.length ? config.recordStatuses : [{ key: 'confirmed', label: 'Confirmed', color: '#2563eb' }];
    const when = ['Today', 'Tomorrow', 'In 2 days', 'In 3 days', 'Next week'];

    const sections: SiteSection[] = [];
    sections.push({ type: 'catalog', label: meta.catalogLabel, items: content.services });

    if (meta.teamLabel && meta.teamRole) {
      sections.push({
        type: 'team',
        label: meta.teamLabel,
        members: NAME_POOL.slice(0, 3).map((name) => ({ name, role: meta.teamRole as string })),
      });
    }

    if (meta.bookingLabel) {
      sections.push({
        type: 'booking',
        label: meta.bookingLabel,
        records: content.services.slice(0, 4).map((s, i) => ({
          title: `${s.name} — ${NAME_POOL[i % NAME_POOL.length]}`,
          when: when[i % when.length],
          status: statuses[i % statuses.length].label,
        })),
      });
    }

    sections.push({ type: 'reviews', label: 'Reviews', items: content.testimonials });
    sections.push({ type: 'about', label: 'About', text: content.about });
    sections.push({ type: 'contact', label: 'Contact' });
    return sections;
  }

  private resolveContent(key: string): DemoContent {
    const config = getIndustryConfig(key);
    return DEMO_CONTENT[key] ?? buildFallback(config.label, config.entities.catalogItem.labelPlural);
  }

  /**
   * Phase 3 — seed a vendor with believable sample data for its industry:
   * catalog items, contacts, records (spread across statuses), and a couple of
   * invoices. Used by the sandbox provisioning (Phase 4). Idempotency is the
   * caller's concern (provision seeds a fresh vendor).
   */
  async seedVendor(vendorId: string, industryKey: string): Promise<{
    contacts: number; catalog: number; records: number; invoices: number;
  }> {
    const config = getIndustryConfig(industryKey);
    const content = this.resolveContent(config.key);
    const statuses = config.recordStatuses.length ? config.recordStatuses : [{ key: 'confirmed', label: 'Confirmed', color: '#2563eb' }];

    return this.prisma.$transaction(async (tx) => {
      // Catalog
      const catalog = await Promise.all(
        content.services.map((s) =>
          tx.catalogItem.create({ data: { vendorId, name: s.name, description: s.desc, price: s.price, active: true } }),
        ),
      );

      // Contacts (5 sample customers)
      const contacts = await Promise.all(
        NAME_POOL.slice(0, 5).map((name, i) =>
          tx.contact.create({
            data: {
              vendorId,
              name,
              phone: `+9198${String(76543000 + i).padStart(8, '0')}`,
              email: `${name.split(' ')[0].toLowerCase()}@example.com`,
              type: 'customer',
            },
          }),
        ),
      );

      // Records (6, spread across statuses/dates/contacts/catalog)
      const now = Date.now();
      const records = await Promise.all(
        Array.from({ length: 6 }).map((_, i) => {
          const item = catalog[i % catalog.length];
          const contact = contacts[i % contacts.length];
          const status = statuses[i % statuses.length];
          const date = new Date(now + (i - 3) * 2 * 86400000); // -6d … +4d
          return tx.record.create({
            data: {
              vendorId,
              contactId: contact.id,
              catalogItemId: item.id,
              status: status.key,
              date,
              amount: item.price,
              notes: `Sample ${config.entities.record.label.toLowerCase()} for ${contact.name}`,
            },
          });
        }),
      );

      // Invoices (2 — one paid, one pending) from the first two records
      let invoiceCount = 0;
      for (let i = 0; i < Math.min(2, records.length); i += 1) {
        const rec = records[i];
        const contact = contacts[i % contacts.length];
        const item = catalog[i % catalog.length];
        const subtotal = item.price;
        const gstRate = 18;
        const gstAmount = Math.round(subtotal * gstRate) / 100;
        const total = subtotal + gstAmount;
        await tx.genericInvoice.create({
          data: {
            vendorId,
            recordId: rec.id,
            contactId: contact.id,
            invoiceNumber: `DA-${now}-${i + 1}`,
            items: [{ description: item.name, quantity: 1, rate: item.price }],
            subtotal,
            gstRate,
            gstAmount,
            total,
            status: i === 0 ? 'PAID' : 'PENDING',
            paidAt: i === 0 ? new Date() : null,
          },
        });
        invoiceCount += 1;
      }

      return { contacts: contacts.length, catalog: catalog.length, records: records.length, invoices: invoiceCount };
    });
  }

  /**
   * Phase 4 — provision a per-lead SANDBOX vendor for the interactive tour: a real
   * Vendor row flagged isSandbox with a 48h expiry, seeded for its industry. The
   * lead accesses it via a short-lived sandbox JWT (no password). Converts to a
   * real account at Phase 5 (buy-now).
   */
  async provisionSandbox(industry: string, name: string, phone: string): Promise<Vendor> {
    const config = getIndustryConfig(industry);
    const content = this.resolveContent(config.key);
    const stamp = Date.now();
    const vendor = await this.prisma.vendor.create({
      data: {
        name: name || 'Demo User',
        email: `sbx_${stamp}_${crypto.randomBytes(3).toString('hex')}@sandbox.get4domain.com`,
        password: crypto.randomBytes(24).toString('hex'), // unusable; auth is via sandbox JWT only
        businessName: content.business,
        phone,
        industry: config.key,
        role: 'VENDOR',
        status: 'ACTIVE',
        isSandbox: true,
        expiresAt: new Date(stamp + 48 * 60 * 60 * 1000),
      },
    });
    await this.seedVendor(vendor.id, config.key);
    // Give the sandbox the same Trial credit so the tour's AI Studio etc. work.
    try {
      const creditPaise = await this.wallet.getRate('trial_free_credit', 10000);
      await this.wallet.grantCredit(vendor.id, creditPaise, 'Demo sandbox credit', 'trial_credit');
    } catch { /* best-effort */ }
    this.logger.log(`Provisioned sandbox vendor ${vendor.id} (${config.key}) for ${name}`);
    return vendor;
  }

  /** Delete expired sandbox vendors and their seeded data (Phase 4 cleanup). */
  async cleanupExpiredSandboxes(): Promise<{ removed: number }> {
    const expired = await this.prisma.vendor.findMany({
      where: { isSandbox: true, expiresAt: { lt: new Date() } },
      select: { id: true },
    });
    let removed = 0;
    for (const v of expired) {
      await this.prisma.$transaction([
        this.prisma.genericInvoice.deleteMany({ where: { vendorId: v.id } }),
        this.prisma.record.deleteMany({ where: { vendorId: v.id } }),
        this.prisma.catalogItem.deleteMany({ where: { vendorId: v.id } }),
        this.prisma.contact.deleteMany({ where: { vendorId: v.id } }),
        this.prisma.vendor.delete({ where: { id: v.id } }),
      ]);
      removed += 1;
    }
    if (removed) this.logger.log(`Cleaned up ${removed} expired sandbox vendor(s)`);
    return { removed };
  }

  /**
   * Public demo-site enquiry: logs a demo lead and sends a WhatsApp confirmation
   * to the enquirer, REUSING item 1's Fast2SMS WhatsApp integration (mock until a
   * key is configured). Kept lightweight; harden against abuse before launch.
   */
  async enquiry(name: string, phone: string, industry: string, message?: string): Promise<{ sent: boolean; mock: boolean }> {
    const lead = await this.prisma.lead.create({
      data: {
        name, phone, business: name, industry,
        interest: 'Demo site enquiry', source: 'demo-site', status: 'new',
        message: message ?? undefined,
      },
    });
    this.logger.log(`Demo-site enquiry ${lead.id} from ${name} (${industry})`);
    const res = await this.whatsapp.sendMessage(
      phone,
      `Hi ${name.split(' ')[0]}, thanks for your enquiry! The ${industry} team will reach out shortly. — via Get4Domain`,
    );
    return { sent: true, mock: res.mock };
  }
}
