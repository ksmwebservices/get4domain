import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChartService } from './core.services';
import { ACC } from './chart';
import { financialYearRange, hsnSummary } from './gst';

export interface Range { from?: Date; to?: Date }

/** Parse "2026-04-01" style dates; `to` is inclusive (end of that day, IST). */
export function parseRange(from?: string, to?: string): Range {
  const f = from ? new Date(from) : undefined;
  let t = to ? new Date(to) : undefined;
  if ((f && Number.isNaN(f.getTime())) || (t && Number.isNaN(t.getTime()))) throw new BadRequestException('Those dates do not look right.');
  if (t && /^\d{4}-\d{2}-\d{2}$/.test(to as string)) t = new Date(t.getTime() + 86_400_000 - 1);
  return { from: f, to: t };
}

export function periodFor(kind: 'month' | 'quarter' | 'year' | 'fy', value: string): Range {
  if (kind === 'fy') { const r = financialYearRange(value); return { from: r.from, to: new Date(r.to.getTime() - 1) }; }
  if (kind === 'month') { const [y, m] = value.split('-').map(Number); return { from: new Date(Date.UTC(y, m - 1, 1) - 330 * 60_000), to: new Date(Date.UTC(y, m, 1) - 330 * 60_000 - 1) }; }
  if (kind === 'quarter') { const [y, q] = value.split('-Q').map(Number); return { from: new Date(Date.UTC(y, (q - 1) * 3, 1) - 330 * 60_000), to: new Date(Date.UTC(y, q * 3, 1) - 330 * 60_000 - 1) }; }
  const y = Number(value); return { from: new Date(Date.UTC(y, 0, 1) - 330 * 60_000), to: new Date(Date.UTC(y + 1, 0, 1) - 330 * 60_000 - 1) };
}

const dateWhere = (r: Range): { gte?: Date; lte?: Date } | undefined => (r.from || r.to ? { ...(r.from ? { gte: r.from } : {}), ...(r.to ? { lte: r.to } : {}) } : undefined);

/** Every report is read from the same records (documents, payments, expenses) and the journal they posted: nothing is typed twice. */
@Injectable()
export class BosReportsService {
  constructor(private readonly prisma: PrismaService, private readonly chart: ChartService) {}

  /** Account balances (debit - credit) for the period, by account code. */
  private async balances(vendorId: string, r: Range): Promise<Map<string, { debit: number; credit: number }>> {
    await this.chart.ensure(this.prisma, vendorId);
    const where: Prisma.BosJournalLineWhereInput = { vendorId, ...(r.from || r.to ? { entry: { is: { entryDate: dateWhere(r) } } } : {}) };
    const g = await this.prisma.bosJournalLine.groupBy({ by: ['accountCode'], where, _sum: { debitPaise: true, creditPaise: true } });
    return new Map(g.map((x) => [x.accountCode, { debit: x._sum.debitPaise ?? 0, credit: x._sum.creditPaise ?? 0 }]));
  }

  private async accounts(vendorId: string) {
    await this.chart.ensure(this.prisma, vendorId);
    return this.prisma.bosAccount.findMany({ where: { vendorId }, orderBy: { code: 'asc' } });
  }

  // ── Essentials: the Accounts page totals ────────────────────────────────────────────────────────

  async summary(vendorId: string, r: Range) {
    const docWhere = { vendorId, status: { not: 'CANCELLED' }, docDate: dateWhere(r) } as const;
    const [inv, cn, pay, exp, open, openDocs] = await Promise.all([
      this.prisma.bosDocument.aggregate({ where: { ...docWhere, docType: 'SALES_INVOICE', status: { in: ['ISSUED', 'PART_PAID', 'PAID'] } }, _sum: { totalPaise: true, taxablePaise: true, cgstPaise: true, sgstPaise: true, igstPaise: true }, _count: true }),
      this.prisma.bosDocument.aggregate({ where: { ...docWhere, docType: 'CREDIT_NOTE', status: { in: ['ISSUED', 'PAID'] } }, _sum: { totalPaise: true, taxablePaise: true, cgstPaise: true, sgstPaise: true, igstPaise: true } }),
      this.prisma.bosPayment.aggregate({ where: { vendorId, kind: 'RECEIPT', status: 'ACTIVE', paymentDate: dateWhere(r) }, _sum: { amountPaise: true } }),
      this.prisma.bosExpense.aggregate({ where: { vendorId, status: 'ACTIVE', expenseDate: dateWhere(r) }, _sum: { totalPaise: true } }),
      this.prisma.bosDocument.aggregate({ where: { vendorId, docType: 'SALES_INVOICE', status: { in: ['ISSUED', 'PART_PAID'] } }, _sum: { totalPaise: true, paidPaise: true } }),
      this.prisma.bosDocument.count({ where: { vendorId, docType: 'SALES_INVOICE', status: { in: ['ISSUED', 'PART_PAID'] } } }),
    ]);
    const tax = (a: { cgstPaise: number | null; sgstPaise: number | null; igstPaise: number | null }): number => (a.cgstPaise ?? 0) + (a.sgstPaise ?? 0) + (a.igstPaise ?? 0);
    const salesPaise = (inv._sum.totalPaise ?? 0) - (cn._sum.totalPaise ?? 0);
    return {
      invoices: inv._count, salesPaise, salesExTaxPaise: (inv._sum.taxablePaise ?? 0) - (cn._sum.taxablePaise ?? 0),
      gstCollectedPaise: tax(inv._sum) - tax(cn._sum), receivedPaise: pay._sum.amountPaise ?? 0, expensesPaise: exp._sum.totalPaise ?? 0,
      outstandingPaise: (open._sum.totalPaise ?? 0) - (open._sum.paidPaise ?? 0), outstandingInvoices: openDocs,
    };
  }

  // ── Books (Pro): ledger, day book, trial balance, P&L, balance sheet ───────────────────────────

  async trialBalance(vendorId: string, asOf?: Date) {
    const [accs, bal] = await Promise.all([this.accounts(vendorId), this.balances(vendorId, { to: asOf })]);
    const rows = accs.map((a) => { const b = bal.get(a.code) ?? { debit: 0, credit: 0 }; const net = b.debit - b.credit; return { code: a.code, name: a.name, type: a.type, debitPaise: net > 0 ? net : 0, creditPaise: net < 0 ? -net : 0 }; }).filter((r) => r.debitPaise || r.creditPaise);
    return { rows, totalDebitPaise: rows.reduce((s, r) => s + r.debitPaise, 0), totalCreditPaise: rows.reduce((s, r) => s + r.creditPaise, 0) };
  }

  async profitAndLoss(vendorId: string, r: Range) {
    const [accs, bal] = await Promise.all([this.accounts(vendorId), this.balances(vendorId, r)]);
    const income: { code: string; name: string; amountPaise: number }[] = []; const expenses: { code: string; name: string; amountPaise: number }[] = [];
    for (const a of accs) {
      const b = bal.get(a.code); if (!b) continue;
      if (a.type === 'INCOME') { const v = b.credit - b.debit; if (v) income.push({ code: a.code, name: a.name, amountPaise: v }); }
      if (a.type === 'EXPENSE') { const v = b.debit - b.credit; if (v) expenses.push({ code: a.code, name: a.name, amountPaise: v }); }
    }
    const totalIncome = income.reduce((s, x) => s + x.amountPaise, 0); const totalExpenses = expenses.reduce((s, x) => s + x.amountPaise, 0);
    const cogs = expenses.find((e) => e.code === ACC.COGS)?.amountPaise ?? 0;
    return { income, expenses, totalIncomePaise: totalIncome, totalExpensesPaise: totalExpenses, grossProfitPaise: totalIncome - cogs, netProfitPaise: totalIncome - totalExpenses };
  }

  async balanceSheet(vendorId: string, asOf?: Date) {
    const [accs, bal, pl] = await Promise.all([this.accounts(vendorId), this.balances(vendorId, { to: asOf }), this.profitAndLoss(vendorId, { to: asOf })]);
    const side = (type: string, sign: 1 | -1) => accs.filter((a) => a.type === type).map((a) => { const b = bal.get(a.code) ?? { debit: 0, credit: 0 }; return { code: a.code, name: a.name, amountPaise: sign * (b.debit - b.credit) }; }).filter((x) => x.amountPaise !== 0);
    const assets = side('ASSET', 1); const liabilities = side('LIABILITY', -1); const equity = side('EQUITY', -1);
    equity.push({ code: 'PL', name: 'Profit so far (all periods)', amountPaise: pl.netProfitPaise });
    const sum = (a: { amountPaise: number }[]): number => a.reduce((s, x) => s + x.amountPaise, 0);
    return { assets, liabilities, equity, totalAssetsPaise: sum(assets), totalLiabilitiesAndEquityPaise: sum(liabilities) + sum(equity) };
  }

  async ledger(vendorId: string, code: string, r: Range) {
    const acc = await this.prisma.bosAccount.findFirst({ where: { vendorId, code } });
    if (!acc) throw new BadRequestException('That account does not exist.');
    const lines = await this.prisma.bosJournalLine.findMany({ where: { vendorId, accountCode: code }, include: { entry: true }, orderBy: [{ entry: { entryDate: 'asc' } }, { id: 'asc' }] });
    const natural = acc.type === 'ASSET' || acc.type === 'EXPENSE' ? 1 : -1;
    let running = 0; let opening = 0; const rows: { date: Date; memo: string | null; sourceType: string; debitPaise: number; creditPaise: number; balancePaise: number }[] = [];
    for (const l of lines) {
      const delta = natural * (l.debitPaise - l.creditPaise);
      if (r.from && l.entry.entryDate < r.from) { opening += delta; running += delta; continue; }
      if (r.to && l.entry.entryDate > r.to) continue;
      running += delta;
      rows.push({ date: l.entry.entryDate, memo: l.entry.memo, sourceType: l.entry.sourceType, debitPaise: l.debitPaise, creditPaise: l.creditPaise, balancePaise: running });
    }
    return { account: { code: acc.code, name: acc.name, type: acc.type }, openingPaise: opening, rows, closingPaise: running };
  }

  async dayBook(vendorId: string, r: Range) {
    const entries = await this.prisma.bosJournalEntry.findMany({ where: { vendorId, entryDate: dateWhere(r) }, include: { lines: true }, orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }], take: 2000 });
    const names = new Map((await this.accounts(vendorId)).map((a) => [a.code, a.name]));
    return entries.map((e) => ({ id: e.id, date: e.entryDate, sourceType: e.sourceType, memo: e.memo, reversal: Boolean(e.reversalOfId), lines: e.lines.map((l) => ({ account: `${l.accountCode} ${names.get(l.accountCode) ?? ''}`.trim(), debitPaise: l.debitPaise, creditPaise: l.creditPaise })) }));
  }

  // ── Registers, GST ─────────────────────────────────────────────────────────────────────────────

  async register(vendorId: string, kind: 'SALES' | 'PURCHASE', r: Range) {
    const types = kind === 'SALES' ? ['SALES_INVOICE', 'CREDIT_NOTE'] : ['PURCHASE_BILL'];
    const rows = await this.prisma.bosDocument.findMany({ where: { vendorId, docType: { in: types }, status: { in: ['ISSUED', 'PART_PAID', 'PAID', 'CANCELLED'] }, docDate: dateWhere(r) }, orderBy: [{ docDate: 'asc' }, { number: 'asc' }] });
    return rows.map((d) => ({ date: d.docDate, number: d.number, type: d.docType, status: d.status, party: d.partyName, gstin: d.partyGstin, place: d.placeOfSupply, taxablePaise: d.taxablePaise, cgstPaise: d.cgstPaise, sgstPaise: d.sgstPaise, igstPaise: d.igstPaise, roundOffPaise: d.roundOffPaise, totalPaise: d.totalPaise, supplierRef: d.supplierRef }));
  }

  /** GSTR-1 and GSTR-3B style tables. Credit notes reduce outward supplies; purchase bills and claimed expenses are the input credit. */
  async gstSummary(vendorId: string, r: Range) {
    const docs = await this.prisma.bosDocument.findMany({ where: { vendorId, docType: { in: ['SALES_INVOICE', 'CREDIT_NOTE', 'PURCHASE_BILL'] }, status: { in: ['ISSUED', 'PART_PAID', 'PAID'] }, docDate: dateWhere(r) }, include: { lines: true } });
    const exp = await this.prisma.bosExpense.findMany({ where: { vendorId, status: 'ACTIVE', expenseDate: dateWhere(r) } });
    const sign = (t: string): number => (t === 'CREDIT_NOTE' ? -1 : 1);
    const b2b = { taxablePaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, count: 0 }; const b2c = { taxablePaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, count: 0 };
    const byRate = new Map<number, { rate: number; taxablePaise: number; taxPaise: number }>();
    const itc = { taxablePaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0 };
    const nonGst = { taxablePaise: 0 };
    for (const d of docs) {
      if (d.docType === 'PURCHASE_BILL') { itc.taxablePaise += d.taxablePaise; itc.cgstPaise += d.cgstPaise; itc.sgstPaise += d.sgstPaise; itc.igstPaise += d.igstPaise; continue; }
      const bucket = d.partyGstin ? b2b : b2c; const sg = sign(d.docType);
      bucket.taxablePaise += sg * d.taxablePaise; bucket.cgstPaise += sg * d.cgstPaise; bucket.sgstPaise += sg * d.sgstPaise; bucket.igstPaise += sg * d.igstPaise; bucket.count += 1;
      if (d.taxKind === 'NONE') nonGst.taxablePaise += sg * d.taxablePaise;
      for (const l of d.lines) { const e = byRate.get(l.gstRate) ?? { rate: l.gstRate, taxablePaise: 0, taxPaise: 0 }; e.taxablePaise += sg * l.taxablePaise; e.taxPaise += sg * (l.cgstPaise + l.sgstPaise + l.igstPaise); byRate.set(l.gstRate, e); }
    }
    for (const e of exp) { itc.cgstPaise += e.cgstPaise; itc.sgstPaise += e.sgstPaise; itc.igstPaise += e.igstPaise; }
    const outTax = b2b.cgstPaise + b2b.sgstPaise + b2b.igstPaise + b2c.cgstPaise + b2c.sgstPaise + b2c.igstPaise;
    const inTax = itc.cgstPaise + itc.sgstPaise + itc.igstPaise;
    return {
      gstr1: { b2b, b2c, byRate: [...byRate.values()].sort((a, b) => a.rate - b.rate) },
      gstr3b: { outwardTaxablePaise: b2b.taxablePaise + b2c.taxablePaise, outwardNilPaise: nonGst.taxablePaise, outputTax: { cgstPaise: b2b.cgstPaise + b2c.cgstPaise, sgstPaise: b2b.sgstPaise + b2c.sgstPaise, igstPaise: b2b.igstPaise + b2c.igstPaise }, inputTaxCredit: itc, netPayablePaise: outTax - inTax },
    };
  }

  async hsn(vendorId: string, r: Range) {
    const lines = await this.prisma.bosDocumentLine.findMany({ where: { vendorId, document: { is: { docType: { in: ['SALES_INVOICE', 'CREDIT_NOTE'] }, status: { in: ['ISSUED', 'PART_PAID', 'PAID'] }, docDate: dateWhere(r) } } }, include: { document: { select: { docType: true } } } });
    return hsnSummary(lines.map((l) => { const s = l.document.docType === 'CREDIT_NOTE' ? -1 : 1; return { hsn: l.hsn, gstRate: l.gstRate, qty: s * l.qty, taxablePaise: s * l.taxablePaise, cgstPaise: s * l.cgstPaise, sgstPaise: s * l.sgstPaise, igstPaise: s * l.igstPaise }; }));
  }

  // ── Stock reports ──────────────────────────────────────────────────────────────────────────────

  async stockValuation(vendorId: string) {
    const items = await this.prisma.vendorProduct.findMany({ where: { vendorId, trackStock: true }, select: { id: true, name: true, sku: true, stockQty: true, purchasePriceAmount: true }, orderBy: { name: 'asc' } });
    const rows = items.map((i) => { const cost = i.purchasePriceAmount == null ? null : Math.round(i.purchasePriceAmount * 100); return { id: i.id, name: i.name, sku: i.sku, qty: i.stockQty ?? 0, unitCostPaise: cost, valuePaise: cost == null ? 0 : Math.round((i.stockQty ?? 0) * cost) }; });
    return { rows, totalPaise: rows.reduce((s, r) => s + r.valuePaise, 0), withoutCost: rows.filter((r) => r.unitCostPaise == null).length };
  }

  async itemProfit(vendorId: string, r: Range) {
    const lines = await this.prisma.bosDocumentLine.findMany({ where: { vendorId, itemId: { not: null }, document: { is: { docType: { in: ['SALES_INVOICE', 'CREDIT_NOTE'] }, status: { in: ['ISSUED', 'PART_PAID', 'PAID'] }, docDate: dateWhere(r) } } }, include: { document: { select: { docType: true } } } });
    const m = new Map<string, { itemId: string; name: string; qty: number; salesPaise: number; costPaise: number }>();
    for (const l of lines) {
      const s = l.document.docType === 'CREDIT_NOTE' ? -1 : 1;
      const e = m.get(l.itemId as string) ?? { itemId: l.itemId as string, name: l.name, qty: 0, salesPaise: 0, costPaise: 0 };
      e.qty += s * l.qty; e.salesPaise += s * l.taxablePaise; e.costPaise += s * (l.unitCostPaise != null ? Math.round(l.qty * l.unitCostPaise) : 0);
      m.set(l.itemId as string, e);
    }
    return [...m.values()].map((e) => ({ ...e, profitPaise: e.salesPaise - e.costPaise })).sort((a, b) => b.profitPaise - a.profitPaise);
  }

  /** Items under their alert level, and the day's headline numbers for the Home "Today" panel. */
  async today(vendorId: string, now = new Date()) {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 330 * 60_000);
    const istShift = (now.getTime() + 330 * 60_000); const d = new Date(istShift); const dayStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - 330 * 60_000);
    void from;
    const r: Range = { from: dayStart, to: new Date(dayStart.getTime() + 86_400_000 - 1) };
    const [s, month] = await Promise.all([this.summary(vendorId, r), this.summary(vendorId, { from: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - 330 * 60_000), to: r.to })]);
    const [lowRows, ordersWaiting] = await Promise.all([
      this.prisma.vendorProduct.findMany({ where: { vendorId, trackStock: true, reorderLevel: { not: null }, active: true }, select: { stockQty: true, reorderLevel: true } }),
      this.prisma.posSale.count({ where: { vendorId, type: 'web', status: 'PENDING_PAYMENT' } }),
    ]);
    const lowStock = lowRows.filter((i) => (i.stockQty ?? 0) <= (i.reorderLevel ?? 0)).length;
    return { lowStock, ordersWaiting, salesTodayPaise: s.salesPaise, collectedTodayPaise: s.receivedPaise, billsToday: s.invoices, outstandingPaise: s.outstandingPaise, outstandingInvoices: s.outstandingInvoices, salesMonthPaise: month.salesPaise, expensesMonthPaise: month.expensesPaise };
  }
}
