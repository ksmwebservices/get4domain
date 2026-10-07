import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Invoice, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { renderInvoiceHtml } from '../invoices/templates/invoice.template';
import { Actor, CommercialAuditService } from './foundation.services';
import { InvoiceBuilderService, SAFE_INVOICE_SELECT, balanceDue } from './invoice-builder.service';
import { DealsService } from './deals.service';
import { normalizePromoCode } from './promo-rules';
import { payUrl } from './pay-token';

// ── Promo codes ───────────────────────────────────────────────────────────────────────────────────

export interface PromoInput {
  code: string;
  description?: string;
  type: 'PERCENT' | 'FLAT';
  value: number;
  appliesToPlans?: ('WORKSPACE' | 'BOS')[];
  appliesToCycles?: ('MONTHLY' | 'HALF_YEARLY' | 'ANNUAL' | 'CUSTOM_MONTHS')[];
  appliesToKinds?: ('ACTIVATION' | 'RENEWAL' | 'PLAN_CHANGE' | 'ADDON' | 'MANAGED_SERVICE')[];
  minCycleMonths?: number | null;
  validFrom?: string | null;
  validTo?: string | null;
  maxRedemptions?: number | null;
  perVendorLimit?: number;
}

@Injectable()
export class PromosService {
  constructor(private readonly prisma: PrismaService, private readonly audit: CommercialAuditService) {}

  async list() {
    const rows = await this.prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    const out = [];
    for (const p of rows) out.push({ ...p, redemptions: await this.prisma.promoRedemption.count({ where: { promoCodeId: p.id } }) });
    return out;
  }

  async create(i: PromoInput, actor: Actor) {
    const code = normalizePromoCode(i.code);
    if (!code) throw new BadRequestException('Code must be 3–32 letters, numbers, - or _');
    if (i.type === 'PERCENT' && !(Number.isInteger(i.value) && i.value >= 1 && i.value <= 100)) throw new BadRequestException('Percent must be a whole number 1–100');
    if (i.type === 'FLAT' && !(Number.isInteger(i.value) && i.value > 0)) throw new BadRequestException('Flat value must be a positive whole number of paise');
    const perVendor = i.perVendorLimit ?? 1;
    if (!Number.isInteger(perVendor) || perVendor < 1 || perVendor > 100) throw new BadRequestException('Per-vendor limit must be 1–100');
    if (i.maxRedemptions != null && (!Number.isInteger(i.maxRedemptions) || i.maxRedemptions < 1)) throw new BadRequestException('Max redemptions must be a positive whole number');
    const validFrom = i.validFrom ? new Date(i.validFrom) : null;
    const validTo = i.validTo ? new Date(i.validTo) : null;
    if ((validFrom && Number.isNaN(validFrom.getTime())) || (validTo && Number.isNaN(validTo.getTime()))) throw new BadRequestException('Invalid validity date');
    if (validFrom && validTo && validTo < validFrom) throw new BadRequestException('"Valid to" is before "valid from"');
    if (await this.prisma.promoCode.findUnique({ where: { code } })) throw new ConflictException('That code already exists');
    const p = await this.prisma.promoCode.create({
      data: {
        code, description: i.description?.slice(0, 200), type: i.type, value: i.value,
        appliesToPlans: i.appliesToPlans ?? [], appliesToCycles: i.appliesToCycles ?? [], appliesToKinds: i.appliesToKinds ?? [],
        minCycleMonths: i.minCycleMonths ?? null, validFrom, validTo, maxRedemptions: i.maxRedemptions ?? null, perVendorLimit: perVendor, createdBy: actor.email,
      },
    });
    await this.audit.log(actor, 'promo.create', 'PromoCode', p.id, { code, type: i.type, value: i.value });
    return p;
  }

  /** Type and value are immutable (an applied-but-unpaid invoice must keep recomputing the same discount). Everything else can change. */
  async update(id: string, patch: { active?: boolean; description?: string; validFrom?: string | null; validTo?: string | null; maxRedemptions?: number | null; perVendorLimit?: number }, actor: Actor) {
    const p = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Promo code not found');
    const data: Prisma.PromoCodeUpdateInput = {};
    if (patch.active !== undefined) data.active = patch.active;
    if (patch.description !== undefined) data.description = patch.description?.slice(0, 200);
    if (patch.validFrom !== undefined) data.validFrom = patch.validFrom ? new Date(patch.validFrom) : null;
    if (patch.validTo !== undefined) data.validTo = patch.validTo ? new Date(patch.validTo) : null;
    if (patch.maxRedemptions !== undefined) data.maxRedemptions = patch.maxRedemptions;
    if (patch.perVendorLimit !== undefined) data.perVendorLimit = Math.max(1, patch.perVendorLimit);
    const u = await this.prisma.promoCode.update({ where: { id }, data });
    await this.audit.log(actor, 'promo.update', 'PromoCode', id, patch as Record<string, unknown>);
    return u;
  }
}

// ── Invoice administration ────────────────────────────────────────────────────────────────────────

@Injectable()
export class InvoiceAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly builder: InvoiceBuilderService,
    private readonly deals: DealsService,
    private readonly invoices: InvoicesService,
    private readonly audit: CommercialAuditService,
  ) {}

  /** Never selects `payTokenHash`; the select is explicit so a future column cannot leak by accident. */
  async list(f: { status?: string; kind?: string; vendorId?: string; q?: string }) {
    const where: Prisma.InvoiceWhereInput = { kind: { not: null } };
    if (f.status) where.status = f.status as never;
    if (f.kind) where.kind = f.kind as never;
    if (f.vendorId) where.vendorId = f.vendorId;
    if (f.q) where.invoiceNumber = { contains: f.q.trim().slice(0, 40), mode: 'insensitive' };
    const rows = await this.prisma.invoice.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300, select: { ...SAFE_INVOICE_SELECT } });
    const vendorIds = [...new Set(rows.map((r) => r.vendorId))];
    const vendors = vendorIds.length ? await this.prisma.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, businessName: true, name: true } }) : [];
    const byId = new Map(vendors.map((v) => [v.id, v]));
    return rows.map((r) => ({ ...r, balanceDuePaise: balanceDue(r), vendor: byId.get(r.vendorId) ?? null }));
  }

  async get(id: string) {
    const inv = await this.prisma.invoice.findUnique({ where: { id }, select: { ...SAFE_INVOICE_SELECT } });
    if (!inv) throw new NotFoundException('Invoice not found');
    const [submissions, audit] = await Promise.all([
      this.prisma.manualPaymentSubmission.findMany({ where: { invoiceId: id }, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, utr: true, claimedAmountPaise: true, confirmedAmountPaise: true, paidAt: true, reason: true, createdAt: true } }),
      this.audit.list('Invoice', id),
    ]);
    return { ...inv, balanceDuePaise: balanceDue(inv), submissions, audit };
  }

  /** "Copy link" / "Resend": issues a FRESH link (the previous one stops working) — a stored token would be a leak risk. */
  async reissueLink(id: string, actor: Actor, opts: { send?: boolean; expiryDays?: number } = {}): Promise<{ payLink: string; sent?: { email: boolean; whatsapp: boolean } }> {
    const inv = await this.prisma.invoice.findUnique({ where: { id } });
    if (!inv || inv.kind == null) throw new NotFoundException('Invoice not found');
    const token = await this.builder.rotateToken(id, opts.expiryDays ?? 14);
    const payLink = payUrl(token);
    await this.audit.log(actor, opts.send ? 'invoice.resend' : 'invoice.link_reissued', 'Invoice', id, {});
    return { payLink, sent: opts.send ? await this.deals.sendLink(id, payLink) : undefined };
  }

  async void(id: string, reason: string, actor: Actor): Promise<Invoice> {
    if ((reason ?? '').trim().length < 3) throw new BadRequestException('A reason is required to void an invoice');
    const inv = await this.prisma.invoice.findUnique({ where: { id } });
    if (!inv || inv.kind == null) throw new NotFoundException('Invoice not found');
    if (inv.status === 'PAID') throw new BadRequestException('A paid invoice cannot be voided');
    if (inv.paidPaise > 0) throw new BadRequestException('Part of this invoice has been paid — settle or refund it outside the system first');
    const claim = await this.prisma.invoice.updateMany({ where: { id, status: { notIn: ['PAID', 'VOID', 'CANCELLED'] } }, data: { status: 'VOID', voidedAt: new Date(), voidReason: reason.trim().slice(0, 300), payTokenHash: null } });
    if (claim.count === 0) throw new ConflictException('This invoice can no longer be voided');
    // Any waiting UTR submissions are no longer applicable.
    await this.prisma.manualPaymentSubmission.updateMany({ where: { invoiceId: id, status: 'SUBMITTED' }, data: { status: 'REJECTED', reason: 'Invoice voided', reviewedBy: actor.email, reviewedAt: new Date() } });
    await this.audit.log(actor, 'invoice.void', 'Invoice', id, { reason });
    return this.prisma.invoice.findUniqueOrThrow({ where: { id } });
  }

  async pdfHtml(id: string): Promise<string> {
    const inv = await this.prisma.invoice.findUnique({ where: { id } });
    if (!inv) throw new NotFoundException('Invoice not found');
    const vendor = await this.prisma.vendor.findUniqueOrThrow({ where: { id: inv.vendorId } });
    const items = ((inv.lineItems as unknown as { label: string; amountPaise: number; qty?: number }[] | null) ?? []).map((l) => ({ description: l.label, price: l.amountPaise * (l.qty ?? 1), discount: 0 }));
    return renderInvoiceHtml(inv as never, vendor as never, {
      company: await this.invoices.resolveCompany(), paymentMode: inv.paidVia ?? undefined, nextRenewal: inv.periodEnd,
      lineItems: items.length ? items : undefined,
    });
  }
}
