import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { BosExpense, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { BosSettingsService, NumberingService, PostingService } from './core.services';
import { BosDocumentsService, DocInput, IssueResult } from './documents.service';
import { BosPaymentsService, PaymentResult } from './payments.service';
import { EXPENSE_HEADS, PAYMENT_MODES } from './chart';
import { expenseLines, openingLines, stockAdjustmentLines } from './posting-rules';
import { isIntraState, toPaise } from './gst';
import { costPaiseOf } from './bos-stock.service';

// ── Expenses ────────────────────────────────────────────────────────────────────────────────────────

export interface ExpenseInput {
  expenseDate?: string;
  /** Expense head account code, e.g. 5300 Rent. */
  category: string;
  description: string;
  supplierId?: string;
  /** Rupees. */
  amount: number;
  gstRate?: number;
  /** The amount already includes the GST. */
  amountIncludesGst?: boolean;
  /** Claim the GST as input credit (default yes when the vendor is GST registered and a rate is given). */
  claimGst?: boolean;
  paymentMode: string;
  attachment?: string;
  recurring?: 'NONE' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  idempotencyKey?: string;
}

const EXPENSE_MODES = PAYMENT_MODES.filter((m) => m !== 'GATEWAY');

@Injectable()
export class BosExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: BosSettingsService,
    private readonly numbering: NumberingService,
    private readonly posting: PostingService,
  ) {}

  async create(vendorId: string, input: ExpenseInput, actor?: string): Promise<BosExpense> {
    if (!EXPENSE_HEADS.some((h) => h.code === input.category)) throw new BadRequestException('Choose what the expense was for.');
    if (!(EXPENSE_MODES as readonly string[]).includes(input.paymentMode)) throw new BadRequestException('Choose how it was paid: cash, UPI, bank, card or cheque.');
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new BadRequestException('Enter an amount above zero.');
    if (!input.description?.trim()) throw new BadRequestException('Say what the expense was for.');
    const date = input.expenseDate ? new Date(input.expenseDate) : new Date();
    if (Number.isNaN(date.getTime())) throw new BadRequestException('That date does not look right.');
    const rate = input.gstRate ?? 0;
    if (!(rate >= 0 && rate <= 100)) throw new BadRequestException('GST rate must be between 0 and 100.');
    if (input.idempotencyKey) {
      const found = await this.prisma.bosExpense.findUnique({ where: { vendorId_idempotencyKey: { vendorId, idempotencyKey: input.idempotencyKey } } });
      if (found) return found;
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.settings.assertOpen(vendorId, date, tx);
        const s = await this.settings.get(vendorId, tx);
        const supplier = input.supplierId ? await tx.contact.findFirst({ where: { id: input.supplierId, vendorId }, select: { id: true, state: true } }) : null;
        if (input.supplierId && !supplier) throw new BadRequestException('That supplier was not found.');
        const entered = toPaise(input.amount);
        const claim = (input.claimGst ?? true) && rate > 0 && s.gstRegistered;
        let taxable = entered; let tax = 0;
        if (rate > 0) {
          if (input.amountIncludesGst) { taxable = Math.round((entered * 100) / (100 + rate)); tax = entered - taxable; } else { tax = Math.round((entered * rate) / 100); }
        }
        const total = taxable + tax;
        const intra = isIntraState(s.state, supplier?.state);
        const cgst = claim && intra ? Math.floor(tax / 2) : 0; const sgst = claim && intra ? tax - Math.floor(tax / 2) : 0; const igst = claim && !intra ? tax : 0;
        const expenseTaxable = claim ? taxable : total; // GST not claimed is part of the cost
        const { number, fy } = await this.numbering.next(tx, vendorId, 'EXPENSE', date);
        const row = await tx.bosExpense.create({
          data: {
            vendorId, number, fy, expenseDate: date, category: input.category, description: input.description.trim().slice(0, 200), supplierId: supplier?.id ?? null,
            taxablePaise: expenseTaxable, gstRate: claim ? rate : 0, cgstPaise: cgst, sgstPaise: sgst, igstPaise: igst, totalPaise: total, paymentMode: input.paymentMode,
            attachment: input.attachment?.slice(0, 500) ?? null, recurring: input.recurring ?? 'NONE', idempotencyKey: input.idempotencyKey ?? null, createdBy: actor ?? null,
          },
        });
        await this.posting.post(tx, { vendorId, sourceType: 'EXPENSE', sourceId: row.id, date, memo: `Expense ${number}: ${row.description}`, lines: expenseLines({ category: input.category, taxablePaise: expenseTaxable, cgstPaise: cgst, sgstPaise: sgst, igstPaise: igst, totalPaise: total, paymentMode: input.paymentMode }) });
        return row;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && input.idempotencyKey) {
        const again = await this.prisma.bosExpense.findUnique({ where: { vendorId_idempotencyKey: { vendorId, idempotencyKey: input.idempotencyKey } } });
        if (again) return again;
      }
      throw e;
    }
  }

  async cancel(vendorId: string, id: string, reason: string): Promise<BosExpense> {
    if ((reason ?? '').trim().length < 3) throw new BadRequestException('Say why you are cancelling it (a few words).');
    const e = await this.prisma.bosExpense.findFirst({ where: { id, vendorId } });
    if (!e) throw new NotFoundException('Expense not found.');
    if (e.status === 'CANCELLED') return e;
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await this.settings.assertOpen(vendorId, e.expenseDate, tx);
      const claim = await tx.bosExpense.updateMany({ where: { id, vendorId, status: 'ACTIVE' }, data: { status: 'CANCELLED', cancelledAt: now, cancelReason: reason.trim().slice(0, 200) } });
      if (claim.count) await this.posting.reverse(tx, vendorId, 'EXPENSE', id, now, `Cancelled: ${reason.trim()}`);
      return tx.bosExpense.findUniqueOrThrow({ where: { id } });
    });
  }

  list(vendorId: string, q: { from?: string; to?: string; category?: string; take?: number; skip?: number }) {
    const where: Prisma.BosExpenseWhereInput = { vendorId, ...(q.category ? { category: q.category } : {}) };
    if (q.from || q.to) where.expenseDate = { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) };
    return this.prisma.bosExpense.findMany({ where, orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }], take: Math.min(q.take ?? 100, 500), skip: q.skip ?? 0 });
  }
}

// ── Counter sale: invoice + receipt(s) + stock + journal in ONE transaction ───────────────────────────

export interface CounterSaleInput {
  lines: DocInput['lines'];
  partyId?: string;
  partyName?: string;
  discount?: number;
  notes?: string;
  taxKind?: 'GST' | 'NONE';
  /** Payment split: cash 500 + UPI 300. Anything not paid stays as the customer's outstanding (a customer is then required). */
  payments: { mode: string; amount: number; reference?: string }[];
  idempotencyKey: string;
}
export interface CounterSaleResult { invoice: IssueResult['doc']; receipts: PaymentResult['payment'][]; warnings: string[]; outstandingPaise: number; replayed: boolean }

@Injectable()
export class BosCounterService {
  constructor(private readonly prisma: PrismaService, private readonly docs: BosDocumentsService, private readonly payments: BosPaymentsService, private readonly settings: BosSettingsService) {}

  async sell(vendorId: string, input: CounterSaleInput, actor?: string): Promise<CounterSaleResult> {
    if (!input.idempotencyKey) throw new BadRequestException('A counter sale needs an idempotency key so a double tap cannot bill twice.');
    const existing = await this.prisma.bosDocument.findUnique({ where: { vendorId_idempotencyKey: { vendorId, idempotencyKey: input.idempotencyKey } }, include: { lines: { orderBy: { lineNo: 'asc' } } } });
    if (existing && existing.status !== 'DRAFT') {
      const receipts = await this.prisma.bosPayment.findMany({ where: { vendorId, source: 'COUNTER', sourceId: existing.id } });
      return { invoice: existing, receipts, warnings: [], outstandingPaise: Math.max(0, existing.totalPaise - existing.paidPaise), replayed: true };
    }
    const payments = (input.payments ?? []).filter((p) => p.amount > 0);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const draft = await this.docs.createDraft(vendorId, { docType: 'SALES_INVOICE', partyId: input.partyId, partyName: input.partyName, lines: input.lines, discount: input.discount, notes: input.notes, taxKind: input.taxKind, source: 'COUNTER', idempotencyKey: input.idempotencyKey }, actor, tx);
        const paidPaise = payments.reduce((a, p) => a + toPaise(p.amount), 0);
        if (paidPaise > draft.totalPaise) throw new BadRequestException('The payments add up to more than the bill. Check the amounts.');
        if (paidPaise < draft.totalPaise && !draft.partyId) throw new BadRequestException('This bill is not fully paid. Choose the customer so the balance is kept against their name, or take the full amount.');
        const issued = await this.docs.issueIn(tx, vendorId, draft.id, { actor });
        const receipts: PaymentResult['payment'][] = [];
        let n = 0;
        for (const p of payments) {
          n += 1;
          const r = await this.payments.recordIn(tx, vendorId, 'RECEIPT', { partyId: draft.partyId ?? undefined, partyName: draft.partyName ?? undefined, mode: p.mode, amount: p.amount, reference: p.reference, allocations: [{ documentId: draft.id, amount: p.amount }], source: 'COUNTER', sourceId: draft.id, idempotencyKey: `${input.idempotencyKey}:pay${n}` }, actor);
          receipts.push(r.payment);
        }
        const fresh = await tx.bosDocument.findUniqueOrThrow({ where: { id: draft.id }, include: { lines: { orderBy: { lineNo: 'asc' } } } });
        return { invoice: fresh, receipts, warnings: issued.warnings, outstandingPaise: Math.max(0, fresh.totalPaise - fresh.paidPaise), replayed: false };
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const again = await this.prisma.bosDocument.findUnique({ where: { vendorId_idempotencyKey: { vendorId, idempotencyKey: input.idempotencyKey } }, include: { lines: { orderBy: { lineNo: 'asc' } } } });
        if (again && again.status !== 'DRAFT') return { invoice: again, receipts: await this.prisma.bosPayment.findMany({ where: { vendorId, source: 'COUNTER', sourceId: again.id } }), warnings: [], outstandingPaise: Math.max(0, again.totalPaise - again.paidPaise), replayed: true };
      }
      throw e;
    }
  }

  /** A walk-in shortcut for the daily summary: today's counter bills by payment mode. */
  async summary(vendorId: string, day = new Date()) {
    const from = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()) - 330 * 60_000); const to = new Date(from.getTime() + 86_400_000);
    const bills = await this.prisma.bosDocument.findMany({ where: { vendorId, docType: 'SALES_INVOICE', source: 'COUNTER', status: { not: 'CANCELLED' }, docDate: { gte: from, lt: to } } });
    const pays = await this.prisma.bosPayment.findMany({ where: { vendorId, kind: 'RECEIPT', source: 'COUNTER', status: 'ACTIVE', paymentDate: { gte: from, lt: to } } });
    const byMode: Record<string, number> = {};
    for (const p of pays) byMode[p.mode] = (byMode[p.mode] ?? 0) + p.amountPaise;
    return { bills: bills.length, totalPaise: bills.reduce((a, b) => a + b.totalPaise, 0), gstPaise: bills.reduce((a, b) => a + b.cgstPaise + b.sgstPaise + b.igstPaise, 0), byMode, creditPaise: bills.reduce((a, b) => a + (b.totalPaise - b.paidPaise), 0) };
  }
}

// ── Website order → invoice (+ receipt) bridge ───────────────────────────────────────────────────────

interface RecordedLine { productId: string | null; catalogItemId: string | null; name: string; qty: number; price: number; tracked: boolean }

/**
 * A website order creates its customer record and its invoice by itself, once. The order already took the stock when it was placed,
 * so the invoice does not take it again (it only records the cost for the books). If the order is cancelled, its invoice and receipt
 * are reversed. Best-effort: a failure here is logged and never fails the order; `reconcile` catches anything missed.
 */
@Injectable()
export class BosOrderBridge {
  private readonly logger = new Logger(BosOrderBridge.name);
  constructor(private readonly prisma: PrismaService, private readonly settings: BosSettingsService, private readonly docs: BosDocumentsService, private readonly payments: BosPaymentsService) {}

  /** Find or create the customer for an order by phone; never overwrites what the vendor already typed. */
  async partyFor(vendorId: string, sale: { customerName: string | null; customerPhone: string | null; customerEmail: string | null; deliveryAddress: string | null }): Promise<string | null> {
    const phone = (sale.customerPhone ?? '').replace(/\D/g, '').slice(-10);
    if (phone.length !== 10) return null;
    const existing = await this.prisma.contact.findFirst({ where: { vendorId, phone: { endsWith: phone } } });
    if (existing) {
      const patch: Prisma.ContactUpdateInput = {};
      if (!existing.email && sale.customerEmail) patch.email = sale.customerEmail;
      if (!existing.address && sale.deliveryAddress) patch.address = sale.deliveryAddress;
      if (Object.keys(patch).length) await this.prisma.contact.update({ where: { id: existing.id }, data: patch });
      return existing.id;
    }
    const created = await this.prisma.contact.create({ data: { vendorId, name: sale.customerName?.trim() || 'Website customer', phone, email: sale.customerEmail ?? null, address: sale.deliveryAddress ?? null, type: 'customer', notes: 'Added from a website order' } });
    return created.id;
  }

  async onOrder(vendorId: string, saleId: string, event: 'PLACED' | 'PAID' | 'CANCELLED'): Promise<void> {
    try {
      if (event === 'CANCELLED') { await this.onCancelled(vendorId, saleId); return; }
      const s = await this.settings.get(vendorId);
      if (s.orderInvoiceOn === 'OFF') { await this.partyForSaleId(vendorId, saleId); return; }
      if (event === 'PLACED' && s.orderInvoiceOn !== 'CONFIRMED') { await this.partyForSaleId(vendorId, saleId); return; }
      await this.ensureInvoice(vendorId, saleId, event === 'PAID');
    } catch (e) {
      this.logger.error(`Order ${saleId}: could not create its invoice yet (${e instanceof Error ? e.message : 'error'}). It is picked up by the next reconcile.`);
    }
  }

  private async partyForSaleId(vendorId: string, saleId: string): Promise<void> {
    const sale = await this.prisma.posSale.findFirst({ where: { id: saleId, vendorId, type: 'web' } });
    if (sale) await this.partyFor(vendorId, sale);
  }

  async ensureInvoice(vendorId: string, saleId: string, paid: boolean): Promise<IssueResult['doc'] | null> {
    const sale = await this.prisma.posSale.findFirst({ where: { id: saleId, vendorId, type: 'web' } });
    if (!sale || sale.status === 'CANCELLED') return null;
    const s = await this.settings.get(vendorId);
    const partyId = await this.partyFor(vendorId, sale);
    const recorded = (Array.isArray(sale.items) ? (sale.items as unknown as RecordedLine[]) : []);
    if (!recorded.length) return null;
    const lines = recorded.map((l) => {
      const [base, variant] = l.name.split(/\s+[—–]\s+/);
      return { itemId: l.productId ?? undefined, name: l.productId ? undefined : base, variantKey: variant?.trim() || undefined, qty: l.qty, rate: l.price };
    });
    const res = await this.docs.createAndIssue(vendorId, {
      docType: 'SALES_INVOICE', partyId: partyId ?? undefined, partyName: partyId ? undefined : sale.customerName ?? 'Website customer', lines,
      // the prices the customer saw are the prices they pay: GST (if the vendor charges it) is INSIDE them and nothing is rounded
      priceMode: 'INCLUSIVE', roundOff: false, taxKind: s.gstRegistered ? 'GST' : 'NONE', docDate: sale.paidAt ?? sale.createdAt, source: 'ORDER', sourceType: 'POS_SALE', sourceId: sale.id, idempotencyKey: `order:${sale.id}`,
      notes: sale.deliveryAddress ? `Deliver to: ${sale.deliveryAddress}` : undefined,
    }, { stockAlreadyMoved: true });
    const invoice = res.doc;
    if (paid || sale.status === 'completed') {
      const mode = sale.paymentMethod === 'razorpay' ? 'GATEWAY' : 'CASH';
      await this.payments.record(vendorId, 'RECEIPT', { partyId: partyId ?? undefined, partyName: sale.customerName ?? undefined, mode, amount: invoice.totalPaise / 100, paymentDate: sale.paidAt ?? new Date(), allocations: [{ documentId: invoice.id, amount: invoice.totalPaise / 100 }], source: 'ORDER', sourceId: sale.id, idempotencyKey: `order-pay:${sale.id}`, reference: sale.razorpayPaymentId ?? undefined });
    }
    return invoice;
  }

  private async onCancelled(vendorId: string, saleId: string): Promise<void> {
    const inv = await this.prisma.bosDocument.findFirst({ where: { vendorId, docType: 'SALES_INVOICE', sourceType: 'POS_SALE', sourceId: saleId } });
    if (!inv || inv.status === 'CANCELLED') return;
    const receipts = await this.prisma.bosPayment.findMany({ where: { vendorId, source: 'ORDER', sourceId: saleId, status: 'ACTIVE' } });
    for (const r of receipts) await this.payments.cancel(vendorId, r.id, 'Order cancelled');
    await this.docs.cancel(vendorId, inv.id, 'Order cancelled');
  }

  /** Create the invoices that were missed (a restart between the order and the bridge, a locked period that was later opened). */
  async reconcile(vendorId: string, sinceDays = 90): Promise<{ created: number }> {
    const s = await this.settings.get(vendorId);
    if (s.orderInvoiceOn === 'OFF') return { created: 0 };
    const since = new Date(Date.now() - sinceDays * 86_400_000);
    const sales = await this.prisma.posSale.findMany({ where: { vendorId, type: 'web', status: { in: s.orderInvoiceOn === 'CONFIRMED' ? ['PENDING_PAYMENT', 'completed'] : ['completed'] }, createdAt: { gte: since } }, select: { id: true, status: true } });
    let created = 0;
    for (const sale of sales) {
      const have = await this.prisma.bosDocument.findFirst({ where: { vendorId, docType: 'SALES_INVOICE', sourceType: 'POS_SALE', sourceId: sale.id }, select: { id: true } });
      if (have) continue;
      try { if (await this.ensureInvoice(vendorId, sale.id, sale.status === 'completed')) created += 1; } catch (e) { this.logger.warn(`reconcile ${sale.id}: ${e instanceof Error ? e.message : 'error'}`); }
    }
    return { created };
  }
}

// ── Manual stock changes post to the books ───────────────────────────────────────────────────────────

/** Every manual stock change (adjust, opening) is posted to the journal in the SAME transaction as the movement, at the item's cost. */
@Injectable()
export class BosStockPosting implements OnModuleInit {
  constructor(private readonly stock: StockService, private readonly posting: PostingService) {}

  onModuleInit(): void {
    this.stock.registerMoveListener(async (tx, { vendorId, productId, movement }) => {
      if (movement.refType === 'BOS_DOC') return;
      const p = await tx.vendorProduct.findFirst({ where: { id: productId, vendorId }, select: { purchasePriceAmount: true } });
      const unit = costPaiseOf(p?.purchasePriceAmount);
      if (unit == null || unit === 0 || movement.delta === 0) return;
      const value = Math.round(movement.delta * unit);
      const lines = movement.reason === 'OPENING' && value > 0
        ? openingLines({ stockPaise: value, receivables: [], payables: [] })
        : stockAdjustmentLines(value);
      await this.posting.post(tx, { vendorId, sourceType: 'STOCK', sourceId: movement.id, date: movement.createdAt, memo: `Stock ${movement.reason.toLowerCase()}`, lines });
    });
  }
}
