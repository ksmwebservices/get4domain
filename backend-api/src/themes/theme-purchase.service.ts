import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { InvoicesService } from '../invoices/invoices.service';
import { SiteRefreshService } from '../site-doc/site-refresh.service';
import { ThemeCatalogService } from './theme-catalog.service';
import { ThemesAdminService } from './themes-admin.service';

export interface ConfirmThemeDto { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }
const YEAR_MS_DAYS = 365;

/**
 * Buying a marketplace theme for a year. It reuses the platform payment path the older template unlock uses (a Razorpay order created by our server with the price from the
 * admin's row plus 18 percent GST, a capture check against Razorpay itself, a GST invoice through InvoicesService). The price is never taken from the browser. The same payment can
 * never grant twice (the payment reference is unique), whether it arrives from the browser confirmation or from the Razorpay webhook.
 */
@Injectable()
export class ThemePurchaseService implements OnModuleInit {
  private readonly log = new Logger(ThemePurchaseService.name);
  constructor(
    private readonly prisma: PrismaService, private readonly payments: PaymentsService, private readonly invoices: InvoicesService,
    private readonly catalog: ThemeCatalogService, private readonly refresh: SiteRefreshService,
  ) {}

  onModuleInit(): void {
    this.payments.registerCapturedHandler(async (p) => { await this.handleCaptured(p); });
  }

  private async liveTheme(key: string, categoryKey: string | null) {
    const t = await this.prisma.themePackage.findFirst({ where: { key, status: 'LIVE' }, orderBy: { version: 'desc' } });
    if (!t) throw new NotFoundException('That theme is not available right now.');
    if (t.role !== 'MARKETPLACE') throw new BadRequestException('This is a free design: no purchase is needed.');
    if (categoryKey && !((t.categories as string[]) ?? []).includes(categoryKey)) throw new BadRequestException('This theme is not made for your kind of business.');
    if (!t.priceYearlyPaise || t.priceYearlyPaise <= 0) throw new BadRequestException('This theme has no price yet, so it cannot be bought.');
    return t;
  }

  async quote(key: string, categoryKey: string | null): Promise<{ basePaise: number; gstPaise: number; totalPaise: number; name: string }> {
    const t = await this.liveTheme(key, categoryKey);
    const basePaise = t.priceYearlyPaise as number; const gstPaise = ThemesAdminService.gst(basePaise);
    return { basePaise, gstPaise, totalPaise: basePaise + gstPaise, name: t.name };
  }

  async createOrder(vendorId: string, key: string, categoryKey: string | null): Promise<{ orderId: string; amount: number; currency: string; basePaise: number; gstPaise: number }> {
    const q = await this.quote(key, categoryKey);
    let order: Awaited<ReturnType<PaymentsService['createOrder']>>;
    try {
      order = await this.payments.createOrder({
        amount: q.totalPaise, currency: 'INR', receipt: `theme_${Date.now()}`,
        notes: { purpose: 'theme_year', vendorId, themeKey: key, base: String(q.basePaise), gst: String(q.gstPaise) },
      });
    } catch {
      throw new ServiceUnavailableException('We could not start the payment just now. Nothing was charged. Please try again in a few minutes.');
    }
    return { orderId: order.id, amount: Number(order.amount), currency: order.currency, basePaise: q.basePaise, gstPaise: q.gstPaise };
  }

  /** The browser's confirmation after paying: Razorpay itself is asked whether this payment was captured, for exactly this amount, for this vendor and this theme. */
  async confirm(vendorId: string, key: string, dto: ConfirmThemeDto): Promise<{ ok: true; endsAt: Date }> {
    const already = await this.prisma.themeEntitlement.findUnique({ where: { paymentRef: dto.razorpayPaymentId } });
    if (already) return { ok: true, endsAt: already.endsAt };
    const q = await this.quote(key, null);
    await this.payments.assertCaptured({
      orderId: dto.razorpayOrderId, paymentId: dto.razorpayPaymentId, signature: dto.razorpaySignature, expectedAmountPaise: q.totalPaise,
      expectedNotes: { purpose: 'theme_year', vendorId, themeKey: key },
    });
    const e = await this.grant(vendorId, key, dto.razorpayPaymentId, q.basePaise, q.gstPaise, q.name);
    return { ok: true, endsAt: e.endsAt };
  }

  /** Razorpay's own "payment captured" message. Only payments our server stamped as a theme purchase are acted on; a repeat of the same message changes nothing. */
  async handleCaptured(p: { id: string; notes?: Record<string, string> | unknown[] | null; amount?: number }): Promise<void> {
    const notes = (p.notes && !Array.isArray(p.notes) ? p.notes : {}) as Record<string, string>;
    if (notes.purpose !== 'theme_year' || !notes.vendorId || !notes.themeKey) return;
    if (await this.prisma.themeEntitlement.findUnique({ where: { paymentRef: p.id } })) return;
    const base = Number(notes.base); const gst = Number(notes.gst);
    if (!Number.isInteger(base) || !Number.isInteger(gst) || typeof p.amount !== 'number' || base + gst !== p.amount) { this.log.warn(`Theme payment ${p.id} does not match its stamped amount; ignored`); return; }
    const t = await this.prisma.themePackage.findFirst({ where: { key: notes.themeKey }, orderBy: { version: 'desc' } });
    await this.grant(notes.vendorId, notes.themeKey, p.id, base, gst, t?.name ?? notes.themeKey);
  }

  /** Records the year. A renewal starts when the current year ends, so no day is lost or paid twice. The unique payment reference makes it safe to call twice. */
  async grant(vendorId: string, key: string, paymentRef: string, basePaise: number, gstPaise: number, themeName: string) {
    const existing = await this.prisma.themeEntitlement.findUnique({ where: { paymentRef } });
    if (existing) return existing;
    const now = new Date();
    const current = await this.catalog.activeEntitlement(vendorId, key, now);
    const startsAt = current ? current.endsAt : now;
    const endsAt = new Date(startsAt.getTime() + YEAR_MS_DAYS * 86_400_000);
    let invoiceRef: string | null = null;
    try {
      const inv = await this.invoices.createPaidInvoice({ vendorId, paidPaise: basePaise + gstPaise, description: `Website theme, one year: ${themeName}`, paymentMode: 'Razorpay', source: 'theme', paymentId: paymentRef });
      invoiceRef = inv?.id ?? null;
    } catch { /* best effort: the licence is already paid for */ }
    const ent = await this.prisma.themeEntitlement.create({ data: { vendorId, themeKey: key, startsAt, endsAt, status: 'ACTIVE', paymentRef, invoiceRef, amountPaise: basePaise, gstPaise } });
    const v = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { subdomain: true } });
    await this.refresh.refresh(v?.subdomain ?? null);
    return ent;
  }
}
