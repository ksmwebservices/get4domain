import { Injectable, NotFoundException } from '@nestjs/common';
import { Expense, PaymentRecord, GstFiling } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpsertGstFilingDto } from './dto/upsert-gst-filing.dto';

const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface AccountingSummary {
  from: string | null; to: string | null;
  revenueNet: number; outputGst: number; revenueGross: number;
  expensesNet: number; inputGst: number; expensesGross: number;
  expensesOnline: number; expensesOffline: number;
  profit: number;          // revenueNet − expensesNet (GST is a pass-through)
  netGstPayable: number;   // outputGst − inputGst
}

/** Travel-specific accounts depth (industry-aware layer over the generic module):
 *  package cost vs. sell price (markup/commission) + supplier payments. */
export interface TravelAccountingSummary {
  tripCount: number;
  totalPackageCost: number;   // what suppliers charged us
  totalSellPrice: number;     // what customers were charged
  grossMargin: number;        // sell − cost (the agency's markup/commission)
  marginPct: number;
  supplierPaymentsTotal: number;   // outward PaymentRecords (hotels, transport, …)
  supplierPaymentsCount: number;
}

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  /** GST EXCLUSIVE: amount is the taxable base; GST is computed on top. Matches the
   *  sales-invoice logic (GenericInvoice / invoices.service GST_RATE 0.18). */
  createExpense(vendorId: string, dto: CreateExpenseDto): Promise<Expense> {
    const gstRate = dto.gstRate ?? 0;
    const gstAmount = round2((dto.amount * gstRate) / 100);
    const total = round2(dto.amount + gstAmount);
    return this.prisma.expense.create({
      data: {
        vendorId,
        description: dto.description,
        category: dto.category,
        amount: dto.amount,
        gstRate,
        gstAmount,
        total,
        paymentMethod: dto.paymentMethod ?? 'offline',
        attachment: dto.attachment,
        date: new Date(dto.date),
      },
    });
  }

  listExpenses(vendorId: string, from?: string, to?: string): Promise<Expense[]> {
    return this.prisma.expense.findMany({
      where: { vendorId, ...this.dateRange('date', from, to) },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Travel accounts depth: aggregates trip package cost vs. sell price (the
   * agency's markup/commission) and supplier payments (outward PaymentRecords).
   * Reuses the existing Trip + PaymentRecord data — no duplicate accounting store.
   */
  async travelSummary(vendorId: string): Promise<TravelAccountingSummary> {
    const [trips, supplier] = await Promise.all([
      this.prisma.trip.findMany({ where: { vendorId }, select: { packageCost: true, sellPrice: true } }),
      this.prisma.paymentRecord.aggregate({
        where: { vendorId, direction: 'outward' },
        _sum: { amount: true },
        _count: true,
      }),
    ]);
    const totalPackageCost = round2(trips.reduce((s, t) => s + t.packageCost, 0));
    const totalSellPrice = round2(trips.reduce((s, t) => s + t.sellPrice, 0));
    const grossMargin = round2(totalSellPrice - totalPackageCost);
    const marginPct = totalSellPrice > 0 ? round2((grossMargin / totalSellPrice) * 100) : 0;
    return {
      tripCount: trips.length,
      totalPackageCost,
      totalSellPrice,
      grossMargin,
      marginPct,
      supplierPaymentsTotal: round2(supplier._sum.amount ?? 0),
      supplierPaymentsCount: supplier._count,
    };
  }

  async getExpense(vendorId: string, id: string): Promise<Expense> {
    const e = await this.prisma.expense.findFirst({ where: { id, vendorId } });
    if (!e) throw new NotFoundException('Expense not found');
    return e;
  }

  async deleteExpense(vendorId: string, id: string): Promise<Expense> {
    await this.getExpense(vendorId, id); // scoped ownership check
    return this.prisma.expense.delete({ where: { id } });
  }

  /** P&L + GST statement for a period, vendorId-scoped. Revenue is realized (paid)
   *  sales invoices; net-of-GST figures drive the P&L, GST shown separately. */
  async summary(vendorId: string, from?: string, to?: string): Promise<AccountingSummary> {
    const [invoices, expenses] = await Promise.all([
      this.prisma.genericInvoice.findMany({
        where: { vendorId, paidAt: { not: null }, ...this.dateRange('paidAt', from, to) },
        select: { subtotal: true, gstAmount: true, total: true },
      }),
      this.prisma.expense.findMany({
        where: { vendorId, ...this.dateRange('date', from, to) },
        select: { amount: true, gstAmount: true, total: true, paymentMethod: true },
      }),
    ]);

    const revenueNet = round2(invoices.reduce((s, i) => s + i.subtotal, 0));
    const outputGst = round2(invoices.reduce((s, i) => s + i.gstAmount, 0));
    const revenueGross = round2(invoices.reduce((s, i) => s + i.total, 0));
    const expensesNet = round2(expenses.reduce((s, e) => s + e.amount, 0));
    const inputGst = round2(expenses.reduce((s, e) => s + e.gstAmount, 0));
    const expensesGross = round2(expenses.reduce((s, e) => s + e.total, 0));
    const expensesOnline = round2(expenses.filter((e) => e.paymentMethod === 'online').reduce((s, e) => s + e.total, 0));
    const expensesOffline = round2(expenses.filter((e) => e.paymentMethod !== 'online').reduce((s, e) => s + e.total, 0));

    return {
      from: from ?? null, to: to ?? null,
      revenueNet, outputGst, revenueGross,
      expensesNet, inputGst, expensesGross,
      expensesOnline, expensesOffline,
      profit: round2(revenueNet - expensesNet),
      netGstPayable: round2(outputGst - inputGst),
    };
  }

  /** Branded expense voucher HTML (client prints to PDF, same pattern as invoices). */
  async renderExpenseHtml(vendorId: string, id: string): Promise<string> {
    const e = await this.getExpense(vendorId, id);
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId }, include: { cms: true } });
    const brand = vendor?.cms?.businessName || vendor?.businessName || 'Business';
    const money = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const date = new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
      <div style="background:#2563eb;color:#fff;padding:18px 24px;"><div style="font-size:18px;font-weight:800;">${brand}</div><div style="font-size:12px;color:#dbeafe;">Expense Voucher</div></div>
      <div style="padding:24px;">
        <table style="width:100%;font-size:14px;border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#64748b;">Date</td><td style="text-align:right;font-weight:600;">${date}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">Description</td><td style="text-align:right;font-weight:600;">${e.description}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">Category</td><td style="text-align:right;">${e.category ?? '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">Payment</td><td style="text-align:right;text-transform:capitalize;">${e.paymentMethod}</td></tr>
        </table>
        <table style="width:100%;font-size:14px;border-collapse:collapse;margin-top:14px;border-top:1px solid #e2e8f0;">
          <tr><td style="padding:8px 0;color:#64748b;">Amount (taxable)</td><td style="text-align:right;">${money(e.amount)}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">GST (${e.gstRate}%)</td><td style="text-align:right;">${money(e.gstAmount)}</td></tr>
          <tr><td style="padding:10px 0;font-weight:800;border-top:1px solid #e2e8f0;">Total</td><td style="text-align:right;font-weight:800;border-top:1px solid #e2e8f0;">${money(e.total)}</td></tr>
        </table>
        <p style="margin-top:18px;font-size:11px;color:#94a3b8;">For the business's own recordkeeping. Generated by Get4Domain.</p>
      </div>
    </div>`;
  }

  // ── Phase 5: Payments ledger (Accounts → Payments tab) ──────────────────
  listPayments(vendorId: string, from?: string, to?: string): Promise<PaymentRecord[]> {
    return this.prisma.paymentRecord.findMany({
      where: { vendorId, ...this.dateRange('date', from, to) },
      orderBy: { date: 'desc' },
    });
  }

  createPayment(vendorId: string, dto: CreatePaymentDto): Promise<PaymentRecord> {
    return this.prisma.paymentRecord.create({
      data: {
        vendorId,
        party: dto.party,
        method: dto.method,
        direction: dto.direction,
        amount: dto.amount,
        reference: dto.reference,
        status: dto.status ?? 'cleared',
        date: new Date(dto.date),
      },
    });
  }

  async deletePayment(vendorId: string, id: string): Promise<PaymentRecord> {
    const row = await this.prisma.paymentRecord.findFirst({ where: { id, vendorId } });
    if (!row) throw new NotFoundException('Payment not found');
    return this.prisma.paymentRecord.delete({ where: { id } });
  }

  // ── Phase 5: GST filing-status tracker (Accounts → GST tab) ─────────────
  listGstFilings(vendorId: string): Promise<GstFiling[]> {
    return this.prisma.gstFiling.findMany({ where: { vendorId }, orderBy: [{ period: 'desc' }, { formType: 'asc' }] });
  }

  /** Idempotent per (vendor, period, formType) — updates status/dates or creates. */
  upsertGstFiling(vendorId: string, dto: UpsertGstFilingDto): Promise<GstFiling> {
    const filedAt = dto.status === 'filed' ? new Date() : null;
    return this.prisma.gstFiling.upsert({
      where: { vendorId_period_formType: { vendorId, period: dto.period, formType: dto.formType } },
      create: {
        vendorId, period: dto.period, formType: dto.formType,
        status: dto.status ?? 'pending',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        filedAt,
      },
      update: {
        status: dto.status ?? 'pending',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        filedAt,
      },
    });
  }

  private dateRange(field: string, from?: string, to?: string) {
    if (!from && !to) return {};
    const range: Record<string, Date> = {};
    if (from) range.gte = new Date(from);
    if (to) { const t = new Date(to); t.setHours(23, 59, 59, 999); range.lte = t; }
    return { [field]: range };
  }
}
