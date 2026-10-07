import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Invoice, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Line, Totals, GstMode, BillingCycle, computeTotals } from './pricing-math';
import { hashPayToken, newPayToken } from './pay-token';
import { PlanKey } from './entitlements';

export type InvoiceKindT = 'ACTIVATION' | 'RENEWAL' | 'PLAN_CHANGE' | 'ADDON' | 'MANAGED_SERVICE';
export type ChannelT = 'RAZORPAY' | 'UPI_QR' | 'OFFLINE';

export interface CreateInvoiceParams {
  vendorId: string;
  kind: InvoiceKindT;
  description: string;
  lines: Line[];
  totals: Totals;
  gstMode: GstMode;
  status: 'DRAFT' | 'SENT';
  dealId?: string | null;
  termId?: string | null;
  planKey?: PlanKey | null;
  billingCycle?: BillingCycle | null;
  cycleMonths?: number | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  discountReason?: string | null;
  adminDiscount?: boolean;
  allowPromoStacking?: boolean;
  promoCodeId?: string | null;
  allowPromoEntry?: boolean;
  allowedChannels: ChannelT[];
  linkExpiryDays: number;
  dueInDays?: number | null;
  gstNumber?: string | null;
  /** The caller's clock (the renewal job runs on its own `now`); defaults to the real time. */
  now?: Date;
}

/** Non-secret view of an invoice (never contains the token hash). */
export const SAFE_INVOICE_SELECT = {
  id: true, invoiceNumber: true, vendorId: true, kind: true, description: true, status: true,
  amount: true, gstAmount: true, totalAmount: true, gstMode: true, listAmountPaise: true, discountPaise: true, discountReason: true,
  lineItems: true, planKey: true, billingCycle: true, cycleMonths: true, periodStart: true, periodEnd: true,
  paidPaise: true, overpaymentPaise: true, paidVia: true, allowedChannels: true, allowPromoEntry: true, promoCodeId: true,
  dueDate: true, sentAt: true, paidAt: true, voidedAt: true, voidReason: true, tokenExpiresAt: true, dealId: true, termId: true,
  createdAt: true, updatedAt: true,
} as const;

@Injectable()
export class InvoiceBuilderService {
  constructor(private readonly prisma: PrismaService) {}

  /** INV-YYYY-NNNN from the highest existing sequence (not a row count, which races and reuses numbers after deletes). */
  private async nextNumber(db: Prisma.TransactionClient | PrismaService): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const last = await db.invoice.findFirst({ where: { invoiceNumber: { startsWith: prefix } }, orderBy: { invoiceNumber: 'desc' }, select: { invoiceNumber: true } });
    const seq = last ? Number(last.invoiceNumber.slice(prefix.length)) || 0 : 0;
    return `${prefix}${String(seq + 1).padStart(4, '0')}`;
  }

  /** Creates the invoice and returns the ONE-TIME clear token (only its hash is stored). */
  async create(p: CreateInvoiceParams): Promise<{ invoice: Invoice; token: string }> {
    const token = newPayToken();
    const lineItems = p.lines.map((l) => ({ kind: l.kind, label: l.label, amountPaise: l.amountPaise, qty: l.qty ?? 1 }));
    const now = p.now ?? new Date();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const invoiceNumber = await this.nextNumber(this.prisma);
        const invoice = await this.prisma.invoice.create({
          data: {
            invoiceNumber, vendorId: p.vendorId, kind: p.kind, description: p.description,
            amount: p.totals.taxablePaise, gstAmount: p.totals.gstPaise, totalAmount: p.totals.totalPaise,
            gstNumber: p.gstNumber ?? undefined,
            status: p.status,
            dealId: p.dealId ?? undefined, termId: p.termId ?? undefined,
            payTokenHash: hashPayToken(token), tokenExpiresAt: new Date(now.getTime() + p.linkExpiryDays * 86_400_000),
            allowedChannels: p.allowedChannels, gstMode: p.gstMode,
            listAmountPaise: p.totals.subtotalPaise, discountPaise: p.totals.discountPaise, discountReason: p.discountReason ?? undefined,
            adminDiscount: Boolean(p.adminDiscount), allowPromoStacking: Boolean(p.allowPromoStacking),
            promoCodeId: p.promoCodeId ?? undefined, allowPromoEntry: Boolean(p.allowPromoEntry),
            lineItems: lineItems as Prisma.InputJsonValue,
            planKey: p.planKey ?? undefined, billingCycle: p.billingCycle ?? undefined, cycleMonths: p.cycleMonths ?? undefined,
            periodStart: p.periodStart ?? undefined, periodEnd: p.periodEnd ?? undefined,
            dueDate: p.dueInDays != null ? new Date(now.getTime() + p.dueInDays * 86_400_000) : undefined,
            sentAt: p.status === 'SENT' ? now : undefined,
          },
        });
        return { invoice, token };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && attempt < 4) continue; // number race → retry
        throw e;
      }
    }
    throw new BadRequestException('Could not allocate an invoice number');
  }

  /** Rotate the pay link: the previous link stops working. The clear token is returned exactly once. */
  async rotateToken(invoiceId: string, expiryDays: number): Promise<string> {
    const inv = await this.prisma.invoice.findUnique({ where: { id: invoiceId }, select: { status: true } });
    if (!inv) throw new NotFoundException('Invoice not found');
    if (['PAID', 'VOID', 'CANCELLED'].includes(inv.status)) throw new BadRequestException('This invoice can no longer be paid');
    const token = newPayToken();
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { payTokenHash: hashPayToken(token), tokenExpiresAt: new Date(Date.now() + expiryDays * 86_400_000), status: inv.status === 'DRAFT' ? 'SENT' : undefined, sentAt: inv.status === 'DRAFT' ? new Date() : undefined },
    });
    return token;
  }

  /** Recompute the stored money fields from the stored lines after the discount changed (promo apply / remove). */
  async reprice(invoiceId: string, discountPaise: number, extra: { promoCodeId: string | null; discountReason?: string | null }): Promise<Invoice> {
    const inv = await this.prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    const lines = (inv.lineItems as unknown as Line[] | null) ?? [];
    const totals = computeTotals(lines, discountPaise, inv.gstMode as GstMode);
    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        amount: totals.taxablePaise, gstAmount: totals.gstPaise, totalAmount: totals.totalPaise,
        listAmountPaise: totals.subtotalPaise, discountPaise: totals.discountPaise,
        promoCodeId: extra.promoCodeId, discountReason: extra.discountReason === undefined ? inv.discountReason : extra.discountReason,
      },
    });
  }
}

/** Amount still owed on an invoice (paise). */
export function balanceDue(inv: { totalAmount: number; paidPaise: number }): number {
  return Math.max(0, inv.totalAmount - inv.paidPaise);
}

/** Statuses from which an invoice can still receive a payment. */
export const PAYABLE_STATUSES = ['PENDING', 'SENT', 'OVERDUE', 'PAYMENT_SUBMITTED', 'PARTIALLY_PAID'] as const;
export function isPayable(status: string): boolean {
  return (PAYABLE_STATUSES as readonly string[]).includes(status);
}
