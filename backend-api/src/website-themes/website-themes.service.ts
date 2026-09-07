import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WebsiteTheme } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { InvoicesService } from '../invoices/invoices.service';
import { CreateWebsiteThemeDto, UpdateWebsiteThemeDto, ConfirmUnlockDto } from './dto/website-theme.dto';

@Injectable()
export class WebsiteThemesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly invoices: InvoicesService,
  ) {}

  /** Themes for a vendor's industry, each with an `unlocked` flag (free = always unlocked). */
  async listForVendor(vendorId: string, industry?: string): Promise<(WebsiteTheme & { unlocked: boolean })[]> {
    const themes = await this.list(industry);
    const rows = await this.prisma.vendorTemplateUnlock.findMany({ where: { vendorId }, select: { themeId: true } });
    const owned = new Set(rows.map((r) => r.themeId));
    return themes.map((t) => ({ ...t, unlocked: !t.price || t.price <= 0 || owned.has(t.id) }));
  }

  /** Whether a vendor may APPLY this theme (free, or a paid unlock exists). */
  async isUnlocked(vendorId: string, themeId: string): Promise<boolean> {
    const theme = await this.get(themeId);
    if (!theme) return false;
    if (!theme.price || theme.price <= 0) return true;
    const row = await this.prisma.vendorTemplateUnlock.findUnique({ where: { vendorId_themeId: { vendorId, themeId } } });
    return Boolean(row);
  }

  /** One-time unlock order for a premium template (platform Razorpay, price + 18% GST). */
  async createUnlockOrder(vendorId: string, themeId: string): Promise<{ orderId: string; amount: number; currency: string }> {
    const theme = await this.get(themeId);
    if (!theme) throw new NotFoundException('Template not found');
    if (!theme.price || theme.price <= 0) throw new BadRequestException('This template is free — no purchase needed.');
    const existing = await this.prisma.vendorTemplateUnlock.findUnique({ where: { vendorId_themeId: { vendorId, themeId } } });
    if (existing) throw new BadRequestException('You already own this template.');
    const base = theme.price * 100; // paise, ex-GST
    const total = base + Math.round(base * 0.18);
    const order = await this.payments.createOrder({ amount: total, currency: 'INR', receipt: `tpl_${vendorId}_${Date.now()}`.slice(0, 40) });
    return { orderId: order.id, amount: Number(order.amount), currency: order.currency };
  }

  /** Verify the platform payment, record the unlock, and issue a GST invoice. */
  async confirmUnlock(vendorId: string, themeId: string, dto: ConfirmUnlockDto): Promise<{ ok: true }> {
    const theme = await this.get(themeId);
    if (!theme) throw new NotFoundException('Template not found');
    if (!this.payments.verifySignature(dto.razorpayOrderId, dto.razorpayPaymentId, dto.razorpaySignature)) {
      throw new BadRequestException('Payment verification failed');
    }
    const base = (theme.price ?? 0) * 100;
    const total = base + Math.round(base * 0.18);
    await this.prisma.vendorTemplateUnlock.upsert({
      where: { vendorId_themeId: { vendorId, themeId } },
      create: { vendorId, themeId, amountPaise: total, paymentId: dto.razorpayPaymentId },
      update: { paymentId: dto.razorpayPaymentId },
    });
    try {
      await this.invoices.createPaidInvoice({
        vendorId, paidPaise: total, description: `Premium website template — ${theme.name}`,
        paymentMode: 'Razorpay', source: 'template', paymentId: dto.razorpayPaymentId,
      });
    } catch { /* best-effort — the unlock already succeeded */ }
    return { ok: true };
  }

  /** Active themes for an industry (industry-scoped OR global), default first. */
  list(industry?: string): Promise<WebsiteTheme[]> {
    return this.prisma.websiteTheme.findMany({
      where: { active: true, ...(industry ? { OR: [{ industry }, { industry: null }] } : {}) },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  listAll(): Promise<WebsiteTheme[]> {
    return this.prisma.websiteTheme.findMany({ orderBy: { createdAt: 'desc' } });
  }

  /** Vendors who have unlocked (purchased) a given theme — audit trail for admin. */
  async purchasers(themeId: string): Promise<Array<{
    vendorId: string; businessName: string; email: string; amountPaise: number; paymentId: string | null; createdAt: Date;
  }>> {
    const rows = await this.prisma.vendorTemplateUnlock.findMany({ where: { themeId }, orderBy: { createdAt: 'desc' } });
    if (rows.length === 0) return [];
    const vendors = await this.prisma.vendor.findMany({
      where: { id: { in: rows.map((r) => r.vendorId) } },
      select: { id: true, businessName: true, email: true },
    });
    const byId = new Map(vendors.map((v) => [v.id, v]));
    return rows.map((r) => ({
      vendorId: r.vendorId,
      businessName: byId.get(r.vendorId)?.businessName ?? '—',
      email: byId.get(r.vendorId)?.email ?? '—',
      amountPaise: r.amountPaise,
      paymentId: r.paymentId,
      createdAt: r.createdAt,
    }));
  }

  get(id: string): Promise<WebsiteTheme | null> {
    return this.prisma.websiteTheme.findUnique({ where: { id } });
  }

  create(dto: CreateWebsiteThemeDto, createdBy?: string): Promise<WebsiteTheme> {
    const { cssVars, layout, pages, ...rest } = dto;
    return this.prisma.websiteTheme.create({
      data: {
        ...rest,
        cssVars: cssVars as Prisma.InputJsonValue,
        ...(layout !== undefined ? { layout: layout as Prisma.InputJsonValue } : {}),
        ...(pages !== undefined ? { pages: pages as unknown as Prisma.InputJsonValue } : {}),
        createdBy,
      },
    });
  }

  async update(id: string, dto: UpdateWebsiteThemeDto): Promise<WebsiteTheme> {
    if (!(await this.prisma.websiteTheme.findUnique({ where: { id } }))) throw new NotFoundException('Theme not found');
    const { cssVars, layout, pages, ...rest } = dto;
    return this.prisma.websiteTheme.update({
      where: { id },
      data: {
        ...rest,
        ...(cssVars !== undefined ? { cssVars: cssVars as Prisma.InputJsonValue } : {}),
        ...(layout !== undefined ? { layout: layout as Prisma.InputJsonValue } : {}),
        ...(pages !== undefined ? { pages: pages as unknown as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async remove(id: string): Promise<WebsiteTheme> {
    if (!(await this.prisma.websiteTheme.findUnique({ where: { id } }))) throw new NotFoundException('Theme not found');
    return this.prisma.websiteTheme.delete({ where: { id } });
  }
}
