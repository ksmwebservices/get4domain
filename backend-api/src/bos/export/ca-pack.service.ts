import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BosReportsService, Range } from '../reports.service';
import { BosPaymentsService } from '../payments.service';
import { BosSettingsService } from '../core.services';
import { Cell, Sheet, ZipEntry, csv, xlsx, zip } from './office';

const m = (paise: number): Cell => ({ money: paise });
const h = (...cols: string[]): Cell[] => cols.map((c) => ({ bold: c }));
const d = (x: Date | null | undefined): string => (x ? new Date(x.getTime() + 330 * 60_000).toISOString().slice(0, 10) : '');
const inr = (p: number): string => `₹${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const esc = (s: string): string => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] as string);

/**
 * The CA pack: every register for a month, quarter or financial year in ONE Excel workbook, a one-page summary and the list of
 * attachments, zipped. It is an export of what the vendor has already recorded; it files nothing anywhere.
 */
@Injectable()
export class BosCaPackService {
  constructor(private readonly prisma: PrismaService, private readonly reports: BosReportsService, private readonly payments: BosPaymentsService, private readonly settings: BosSettingsService) {}

  async sheets(vendorId: string, r: Range): Promise<{ sheets: Sheet[]; summaryHtml: string; attachments: Cell[][]; title: string }> {
    const [s, vendor, summary, sales, purchases, gst, hsn, pl, bs, tb, valuation, custAge, suppAge, receipts, paysOut, expenses] = await Promise.all([
      this.settings.get(vendorId), this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { businessName: true } }),
      this.reports.summary(vendorId, r), this.reports.register(vendorId, 'SALES', r), this.reports.register(vendorId, 'PURCHASE', r), this.reports.gstSummary(vendorId, r), this.reports.hsn(vendorId, r),
      this.reports.profitAndLoss(vendorId, r), this.reports.balanceSheet(vendorId, r.to), this.reports.trialBalance(vendorId, r.to), this.reports.stockValuation(vendorId),
      this.payments.outstanding(vendorId, 'CUSTOMER', r.to ?? new Date()), this.payments.outstanding(vendorId, 'SUPPLIER', r.to ?? new Date()),
      this.payments.list(vendorId, { kind: 'RECEIPT', from: r.from?.toISOString(), to: r.to?.toISOString(), take: 200 }), this.payments.list(vendorId, { kind: 'PAYMENT_OUT', from: r.from?.toISOString(), to: r.to?.toISOString(), take: 200 }),
      this.prisma.bosExpense.findMany({ where: { vendorId, status: 'ACTIVE', expenseDate: { ...(r.from ? { gte: r.from } : {}), ...(r.to ? { lte: r.to } : {}) } }, orderBy: { expenseDate: 'asc' } }),
    ]);
    const name = s.legalName ?? vendor?.businessName ?? 'Business';
    const period = `${d(r.from) || 'start'} to ${d(r.to) || 'today'}`;
    const reg = (rows: typeof sales): Cell[][] => [h('Date', 'Number', 'Type', 'Status', 'Party', 'GSTIN', 'Place of supply', 'Taxable', 'CGST', 'SGST', 'IGST', 'Round off', 'Total', 'Supplier bill no.'), ...rows.map((x) => [d(x.date), x.number ?? '', x.type, x.status, x.party ?? '', x.gstin ?? '', x.place ?? '', m(x.taxablePaise), m(x.cgstPaise), m(x.sgstPaise), m(x.igstPaise), m(x.roundOffPaise), m(x.totalPaise), x.supplierRef ?? ''])];
    const ageing = (a: Awaited<ReturnType<BosPaymentsService['outstanding']>>): Cell[][] => [h('Party', '0-30', '31-60', '61-90', '90+', 'Total'), ...a.parties.map((p) => [p.partyName, m(p.buckets['0-30']), m(p.buckets['31-60']), m(p.buckets['61-90']), m(p.buckets['90+']), m(p.totalPaise)]), [{ bold: 'Total' }, m(a.buckets['0-30']), m(a.buckets['31-60']), m(a.buckets['61-90']), m(a.buckets['90+']), m(a.totalPaise)]];
    const attachments: Cell[][] = [h('Date', 'Expense', 'Description', 'Attachment'), ...expenses.filter((e) => e.attachment).map((e) => [d(e.expenseDate), e.number ?? '', e.description, e.attachment ?? ''])];

    const sheets: Sheet[] = [
      { name: 'Summary', widths: [34, 18], rows: [[{ bold: name }], [`Period: ${period}`], [s.gstin ? `GSTIN: ${s.gstin}` : 'Not registered for GST'], [], h('Item', 'Amount'), ['Sales (after credit notes)', m(summary.salesPaise)], ['GST collected', m(summary.gstCollectedPaise)], ['Received', m(summary.receivedPaise)], ['Customers still owe', m(summary.outstandingPaise)], ['Expenses', m(summary.expensesPaise)], ['Net profit', m(pl.netProfitPaise)], ['Net GST payable', m(gst.gstr3b.netPayablePaise)]] },
      { name: 'Sales register', widths: [12, 18, 14, 12, 26, 18, 18, 14, 12, 12, 12, 10, 14, 16], rows: reg(sales) },
      { name: 'Purchase register', widths: [12, 18, 14, 12, 26, 18, 18, 14, 12, 12, 12, 10, 14, 16], rows: reg(purchases) },
      { name: 'Receipts', rows: [h('Date', 'Number', 'Customer', 'Mode', 'Amount', 'Reference', 'Status'), ...receipts.map((x) => [d(x.paymentDate), x.number ?? '', x.partyName ?? '', x.mode, m(x.amountPaise), x.reference ?? '', x.status])] },
      { name: 'Payments out', rows: [h('Date', 'Number', 'Supplier', 'Mode', 'Amount', 'Reference', 'Status'), ...paysOut.map((x) => [d(x.paymentDate), x.number ?? '', x.partyName ?? '', x.mode, m(x.amountPaise), x.reference ?? '', x.status])] },
      { name: 'Expenses', rows: [h('Date', 'Number', 'Head', 'Description', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'Paid by'), ...expenses.map((x) => [d(x.expenseDate), x.number ?? '', x.category, x.description, m(x.taxablePaise), m(x.cgstPaise), m(x.sgstPaise), m(x.igstPaise), m(x.totalPaise), x.paymentMode])] },
      { name: 'GSTR-1', rows: [h('Table', 'Taxable', 'CGST', 'SGST', 'IGST', 'Count'), ['B2B (buyer has GSTIN)', m(gst.gstr1.b2b.taxablePaise), m(gst.gstr1.b2b.cgstPaise), m(gst.gstr1.b2b.sgstPaise), m(gst.gstr1.b2b.igstPaise), gst.gstr1.b2b.count], ['B2C (no GSTIN)', m(gst.gstr1.b2c.taxablePaise), m(gst.gstr1.b2c.cgstPaise), m(gst.gstr1.b2c.sgstPaise), m(gst.gstr1.b2c.igstPaise), gst.gstr1.b2c.count], [], h('GST rate %', 'Taxable', 'Tax'), ...gst.gstr1.byRate.map((x) => [x.rate, m(x.taxablePaise), m(x.taxPaise)])] },
      { name: 'GSTR-3B', rows: [h('Item', 'Taxable', 'CGST', 'SGST', 'IGST'), ['Outward taxable supplies', m(gst.gstr3b.outwardTaxablePaise), m(gst.gstr3b.outputTax.cgstPaise), m(gst.gstr3b.outputTax.sgstPaise), m(gst.gstr3b.outputTax.igstPaise)], ['Outward supplies without tax (bill of supply)', m(gst.gstr3b.outwardNilPaise)], ['Input tax credit', m(gst.gstr3b.inputTaxCredit.taxablePaise), m(gst.gstr3b.inputTaxCredit.cgstPaise), m(gst.gstr3b.inputTaxCredit.sgstPaise), m(gst.gstr3b.inputTaxCredit.igstPaise)], ['Net GST payable', m(gst.gstr3b.netPayablePaise)]] },
      { name: 'HSN summary', rows: [h('HSN/SAC', 'GST rate %', 'Quantity', 'Taxable', 'CGST', 'SGST', 'IGST'), ...hsn.map((x) => [x.hsn, x.gstRate, x.qty, m(x.taxablePaise), m(x.cgstPaise), m(x.sgstPaise), m(x.igstPaise)])] },
      { name: 'Receivables ageing', rows: ageing(custAge) },
      { name: 'Payables ageing', rows: ageing(suppAge) },
      { name: 'Trial balance', rows: [h('Code', 'Account', 'Debit', 'Credit'), ...tb.rows.map((x) => [x.code, x.name, m(x.debitPaise), m(x.creditPaise)]), [{ bold: 'Total' }, '', m(tb.totalDebitPaise), m(tb.totalCreditPaise)]] },
      { name: 'Profit and loss', rows: [h('Income', 'Amount'), ...pl.income.map((x) => [x.name, m(x.amountPaise)]), [{ bold: 'Total income' }, m(pl.totalIncomePaise)], [], h('Expenses', 'Amount'), ...pl.expenses.map((x) => [x.name, m(x.amountPaise)]), [{ bold: 'Total expenses' }, m(pl.totalExpensesPaise)], [], [{ bold: 'Net profit' }, m(pl.netProfitPaise)]] },
      { name: 'Balance sheet', rows: [h('Assets', 'Amount'), ...bs.assets.map((x) => [x.name, m(x.amountPaise)]), [{ bold: 'Total assets' }, m(bs.totalAssetsPaise)], [], h('Liabilities and equity', 'Amount'), ...bs.liabilities.map((x) => [x.name, m(x.amountPaise)]), ...bs.equity.map((x) => [x.name, m(x.amountPaise)]), [{ bold: 'Total' }, m(bs.totalLiabilitiesAndEquityPaise)]] },
      { name: 'Stock valuation', rows: [h('Item', 'SKU', 'Quantity', 'Cost per unit', 'Value'), ...valuation.rows.map((x) => [x.name, x.sku ?? '', x.qty, x.unitCostPaise == null ? 'no cost' : m(x.unitCostPaise), m(x.valuePaise)]), [{ bold: 'Total' }, '', '', '', m(valuation.totalPaise)]] },
      { name: 'Attachments', widths: [12, 14, 40, 60], rows: attachments },
    ];
    const summaryHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(name)} — CA summary</title><style>body{font-family:Arial,sans-serif;max-width:720px;margin:24px auto;color:#0f172a}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #e2e8f0;text-align:left}td:last-child,th:last-child{text-align:right}h1{font-size:20px}small{color:#64748b}</style></head><body><h1>${esc(name)}</h1><small>${esc(s.gstin ? `GSTIN ${s.gstin}` : 'Not registered for GST')} · ${esc(period)}</small><table><tr><th>Item</th><th>Amount</th></tr><tr><td>Sales (after credit notes)</td><td>${inr(summary.salesPaise)}</td></tr><tr><td>GST collected</td><td>${inr(summary.gstCollectedPaise)}</td></tr><tr><td>Received</td><td>${inr(summary.receivedPaise)}</td></tr><tr><td>Customers still owe</td><td>${inr(summary.outstandingPaise)}</td></tr><tr><td>Expenses</td><td>${inr(summary.expensesPaise)}</td></tr><tr><td><b>Net profit</b></td><td><b>${inr(pl.netProfitPaise)}</b></td></tr><tr><td>Net GST payable</td><td>${inr(gst.gstr3b.netPayablePaise)}</td></tr></table><p><small>Prepared from the records in the system. This is an export for your accountant; nothing is filed anywhere.</small></p></body></html>`;
    return { sheets, summaryHtml, attachments, title: `${name.replace(/[^A-Za-z0-9]+/g, '-')}-${d(r.from) || 'start'}-to-${d(r.to) || 'today'}` };
  }

  async workbook(vendorId: string, r: Range): Promise<{ filename: string; data: Buffer }> {
    const x = await this.sheets(vendorId, r);
    return { filename: `${x.title}.xlsx`, data: xlsx(x.sheets) };
  }

  async pack(vendorId: string, r: Range): Promise<{ filename: string; data: Buffer }> {
    const x = await this.sheets(vendorId, r);
    const entries: ZipEntry[] = [
      { name: `${x.title}.xlsx`, data: xlsx(x.sheets) },
      { name: 'summary.html', data: Buffer.from(x.summaryHtml, 'utf8') },
      { name: 'attachments.csv', data: Buffer.from(csv(x.attachments), 'utf8') },
    ];
    return { filename: `${x.title}-CA-pack.zip`, data: zip(entries) };
  }
}
