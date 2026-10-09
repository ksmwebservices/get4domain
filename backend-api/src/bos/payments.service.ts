import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BosPayment, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BosSettingsService, NumberingService, PostingService, Tx } from './core.services';
import { BosDocumentsService } from './documents.service';
import { ACC, PAYMENT_MODES } from './chart';
import { advanceAppliedLines, paymentOutLines, receiptLines, supplierAdvanceAppliedLines } from './posting-rules';
import { toPaise } from './gst';

export interface AllocationInput { documentId: string; amount: number }
export interface PaymentInput {
  partyId?: string;
  partyName?: string;
  mode: string;
  /** Rupees. */
  amount: number;
  paymentDate?: string | Date;
  reference?: string;
  notes?: string;
  allocations?: AllocationInput[];
  /** Apply to this party's oldest open documents first. */
  auto?: boolean;
  source?: string;
  sourceId?: string;
  idempotencyKey?: string;
}

export interface PaymentResult { payment: BosPayment; allocatedPaise: number; advancePaise: number; replayed: boolean }

const OPEN = ['ISSUED', 'PART_PAID'];
const BUCKETS = [{ key: '0-30', max: 30 }, { key: '31-60', max: 60 }, { key: '61-90', max: 90 }, { key: '90+', max: Infinity }] as const;

/** Money in (receipts) and money out (payments to suppliers), allocated to invoices / purchase bills. Part payments, advances, ageing, statements. */
@Injectable()
export class BosPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: BosSettingsService,
    private readonly numbering: NumberingService,
    private readonly posting: PostingService,
    private readonly docs: BosDocumentsService,
  ) {}

  private kindFor(kind: 'RECEIPT' | 'PAYMENT_OUT') { return kind === 'RECEIPT' ? { doc: 'SALES_INVOICE', series: 'RECEIPT' as const } : { doc: 'PURCHASE_BILL', series: 'PAYMENT_OUT' as const }; }

  /** Receipt (customer pays us) or payment out (we pay a supplier). Idempotent per key. */
  async record(vendorId: string, kind: 'RECEIPT' | 'PAYMENT_OUT', input: PaymentInput, actor?: string): Promise<PaymentResult> {
    try {
      return await this.prisma.$transaction((tx) => this.recordIn(tx, vendorId, kind, input, actor));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && input.idempotencyKey) {
        const again = await this.prisma.bosPayment.findUnique({ where: { vendorId_idempotencyKey: { vendorId, idempotencyKey: input.idempotencyKey } }, include: { allocations: true } });
        if (again) { const a = again.allocations.reduce((s, x) => s + x.amountPaise, 0); return { payment: again, allocatedPaise: a, advancePaise: again.amountPaise - a, replayed: true }; }
      }
      throw e;
    }
  }

  /** The record steps inside a caller's transaction. */
  async recordIn(tx: Tx, vendorId: string, kind: 'RECEIPT' | 'PAYMENT_OUT', input: PaymentInput, actor?: string): Promise<PaymentResult> {
    if (!(PAYMENT_MODES as readonly string[]).includes(input.mode)) throw new BadRequestException('Choose how the money was paid: cash, UPI, bank, card, cheque or gateway.');
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new BadRequestException('Enter an amount above zero.');
    const amountPaise = toPaise(input.amount);
    const date = input.paymentDate ? new Date(input.paymentDate) : new Date();
    if (Number.isNaN(date.getTime())) throw new BadRequestException('That date does not look right.');
    if (input.idempotencyKey) {
      const found = await tx.bosPayment.findUnique({ where: { vendorId_idempotencyKey: { vendorId, idempotencyKey: input.idempotencyKey } }, include: { allocations: true } });
      if (found) { const a = found.allocations.reduce((s, x) => s + x.amountPaise, 0); return { payment: found, allocatedPaise: a, advancePaise: found.amountPaise - a, replayed: true }; }
    }
    const k = this.kindFor(kind);
    {
      {
        await this.settings.assertOpen(vendorId, date, tx);
        let party: { id: string; name: string } | null = null;
        if (input.partyId) {
          party = await tx.contact.findFirst({ where: { id: input.partyId, vendorId }, select: { id: true, name: true } });
          if (!party) throw new BadRequestException('That customer or supplier was not found.');
        }
        const plan = await this.planAllocations(tx, vendorId, k.doc, party?.id ?? null, amountPaise, input);
        const { number, fy } = await this.numbering.next(tx, vendorId, k.series, date);
        const payment = await tx.bosPayment.create({
          data: {
            vendorId, kind, number, fy, partyId: party?.id ?? null, partyName: party?.name ?? input.partyName?.trim() ?? null, mode: input.mode, amountPaise, paymentDate: date,
            reference: input.reference?.trim().slice(0, 80) ?? null, notes: input.notes?.trim().slice(0, 300) ?? null, source: input.source ?? 'MANUAL', sourceId: input.sourceId ?? null,
            idempotencyKey: input.idempotencyKey ?? null, createdBy: actor ?? null,
            allocations: { create: plan.map((a) => ({ vendorId, documentId: a.documentId, amountPaise: a.amountPaise })) },
          },
        });
        const allocated = plan.reduce((s, a) => s + a.amountPaise, 0);
        for (const a of plan) await this.docs.recomputePaid(tx, vendorId, a.documentId);
        const lines = kind === 'RECEIPT' ? receiptLines({ partyId: party?.id, mode: input.mode, amountPaise, allocatedPaise: allocated }) : paymentOutLines({ partyId: party?.id, mode: input.mode, amountPaise, allocatedPaise: allocated });
        await this.posting.post(tx, { vendorId, sourceType: kind, sourceId: payment.id, date, memo: `${kind === 'RECEIPT' ? 'Receipt' : 'Payment'} ${number}`, lines });
        return { payment, allocatedPaise: allocated, advancePaise: amountPaise - allocated, replayed: false };
      }
    }
  }

  /** Which documents this payment settles, and how much of each. Never more than a document's outstanding, never more than the payment. */
  private async planAllocations(tx: Tx, vendorId: string, docType: string, partyId: string | null, amountPaise: number, input: PaymentInput): Promise<{ documentId: string; amountPaise: number }[]> {
    const plan: { documentId: string; amountPaise: number }[] = [];
    let left = amountPaise;
    if (input.allocations?.length) {
      for (const a of input.allocations) {
        const want = toPaise(a.amount);
        if (want <= 0) continue;
        const d = await tx.bosDocument.findFirst({ where: { id: a.documentId, vendorId, docType } });
        if (!d || !OPEN.includes(d.status)) throw new BadRequestException('One of the documents is not open (it may be paid, cancelled or not yet issued).');
        if (partyId && d.partyId && d.partyId !== partyId) throw new BadRequestException('That document belongs to a different customer or supplier.');
        const out = d.totalPaise - d.paidPaise;
        if (want > out) throw new BadRequestException(`${d.number}: only ${(out / 100).toFixed(2)} is outstanding.`);
        if (want > left) throw new BadRequestException('The amounts you applied are more than the payment.');
        plan.push({ documentId: d.id, amountPaise: want }); left -= want;
      }
    } else if (input.auto && partyId) {
      const open = await tx.bosDocument.findMany({ where: { vendorId, docType, partyId, status: { in: OPEN } }, orderBy: [{ docDate: 'asc' }, { createdAt: 'asc' }] });
      for (const d of open) {
        if (left <= 0) break;
        const take = Math.min(left, d.totalPaise - d.paidPaise);
        if (take > 0) { plan.push({ documentId: d.id, amountPaise: take }); left -= take; }
      }
    }
    return plan;
  }

  /** Apply the unallocated part of an earlier payment (an advance) to documents. */
  async applyAdvance(vendorId: string, paymentId: string, allocations: AllocationInput[], actor?: string): Promise<PaymentResult> {
    void actor;
    return this.prisma.$transaction(async (tx) => {
      const p = await tx.bosPayment.findFirst({ where: { id: paymentId, vendorId, status: 'ACTIVE' }, include: { allocations: true } });
      if (!p) throw new NotFoundException('Payment not found.');
      const used = p.allocations.reduce((s, x) => s + x.amountPaise, 0);
      const k = this.kindFor(p.kind as 'RECEIPT' | 'PAYMENT_OUT');
      const plan = await this.planAllocations(tx, vendorId, k.doc, p.partyId, p.amountPaise - used, { mode: p.mode, amount: 0, allocations });
      if (!plan.length) throw new BadRequestException('Choose at least one document to apply it to.');
      const n = p.allocations.length;
      for (const a of plan) { await tx.bosAllocation.create({ data: { vendorId, documentId: a.documentId, paymentId, amountPaise: a.amountPaise } }); await this.docs.recomputePaid(tx, vendorId, a.documentId); }
      const total = plan.reduce((s, a) => s + a.amountPaise, 0);
      if (p.kind === 'RECEIPT') await this.posting.post(tx, { vendorId, sourceType: 'RECEIPT_ALLOC', sourceId: `${paymentId}:${n}`, date: new Date(), memo: `Advance applied (${p.number})`, lines: advanceAppliedLines({ partyId: p.partyId, amountPaise: total }) });
      else await this.posting.post(tx, { vendorId, sourceType: 'PAYMENT_ALLOC', sourceId: `${paymentId}:${n}`, date: new Date(), memo: `Advance applied (${p.number})`, lines: supplierAdvanceAppliedLines({ partyId: p.partyId, amountPaise: total }) });
      return { payment: p, allocatedPaise: used + total, advancePaise: p.amountPaise - used - total, replayed: false };
    });
  }

  async cancel(vendorId: string, paymentId: string, reason: string): Promise<BosPayment> {
    if ((reason ?? '').trim().length < 3) throw new BadRequestException('Say why you are cancelling it (a few words).');
    const p = await this.prisma.bosPayment.findFirst({ where: { id: paymentId, vendorId }, include: { allocations: true } });
    if (!p) throw new NotFoundException('Payment not found.');
    if (p.status === 'CANCELLED') return p;
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await this.settings.assertOpen(vendorId, p.paymentDate, tx);
      const claim = await tx.bosPayment.updateMany({ where: { id: paymentId, vendorId, status: 'ACTIVE' }, data: { status: 'CANCELLED', cancelledAt: now, cancelReason: reason.trim().slice(0, 200) } });
      if (claim.count === 0) return tx.bosPayment.findUniqueOrThrow({ where: { id: paymentId } });
      await this.posting.reverse(tx, vendorId, p.kind, paymentId, now, `Cancelled: ${reason.trim()}`);
      const allocEntries = await tx.bosJournalEntry.findMany({ where: { vendorId, sourceType: { in: ['RECEIPT_ALLOC', 'PAYMENT_ALLOC'] }, sourceId: { startsWith: `${paymentId}:` }, reversalOfId: null }, select: { sourceType: true, sourceId: true } });
      for (const e of allocEntries) await this.posting.reverse(tx, vendorId, e.sourceType, e.sourceId, now, `Cancelled: ${reason.trim()}`);
      for (const a of p.allocations) await this.docs.recomputePaid(tx, vendorId, a.documentId);
      return tx.bosPayment.findUniqueOrThrow({ where: { id: paymentId } });
    });
  }

  async list(vendorId: string, q: { kind?: 'RECEIPT' | 'PAYMENT_OUT'; partyId?: string; from?: string; to?: string; take?: number; skip?: number }) {
    const where: Prisma.BosPaymentWhereInput = { vendorId, ...(q.kind ? { kind: q.kind } : {}), ...(q.partyId ? { partyId: q.partyId } : {}) };
    if (q.from || q.to) where.paymentDate = { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) };
    const rows = await this.prisma.bosPayment.findMany({ where, include: { allocations: true }, orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }], take: Math.min(q.take ?? 50, 200), skip: q.skip ?? 0 });
    return rows.map((r) => ({ ...r, allocatedPaise: r.allocations.reduce((s, a) => s + a.amountPaise, 0), advancePaise: r.status === 'ACTIVE' ? r.amountPaise - r.allocations.reduce((s, a) => s + a.amountPaise, 0) : 0 }));
  }

  // ── Outstanding, ageing, statements ──────────────────────────────────────────────────────────────

  /** Open invoices (kind CUSTOMER) or purchase bills (SUPPLIER) with the age of each, grouped by party. */
  async outstanding(vendorId: string, kind: 'CUSTOMER' | 'SUPPLIER', asOf: Date = new Date()) {
    const docs = await this.prisma.bosDocument.findMany({ where: { vendorId, docType: kind === 'CUSTOMER' ? 'SALES_INVOICE' : 'PURCHASE_BILL', status: { in: OPEN } }, orderBy: { docDate: 'asc' } });
    const parties = new Map<string, { partyId: string | null; partyName: string; totalPaise: number; buckets: Record<string, number>; documents: { id: string; number: string | null; docDate: Date; dueDate: Date | null; totalPaise: number; outstandingPaise: number; ageDays: number; bucket: string }[] }>();
    const totals: Record<string, number> = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    for (const d of docs) {
      const out = d.totalPaise - d.paidPaise;
      if (out <= 0) continue;
      const age = Math.max(0, Math.floor((asOf.getTime() - d.docDate.getTime()) / 86_400_000));
      const bucket = BUCKETS.find((b) => age <= b.max)?.key ?? '90+';
      const key = d.partyId ?? `walkin:${d.partyName ?? ''}`;
      const p = parties.get(key) ?? { partyId: d.partyId, partyName: d.partyName ?? 'Walk-in', totalPaise: 0, buckets: { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }, documents: [] };
      p.totalPaise += out; p.buckets[bucket] += out; totals[bucket] += out;
      p.documents.push({ id: d.id, number: d.number, docDate: d.docDate, dueDate: d.dueDate, totalPaise: d.totalPaise, outstandingPaise: out, ageDays: age, bucket });
      parties.set(key, p);
    }
    return { totalPaise: Object.values(totals).reduce((a, b) => a + b, 0), buckets: totals, parties: [...parties.values()].sort((a, b) => b.totalPaise - a.totalPaise) };
  }

  /** A party's account from the journal: what they owe (customers) or what is owed to them (suppliers), line by line, with a running balance. */
  async statement(vendorId: string, partyId: string, from?: string, to?: string) {
    const party = await this.prisma.contact.findFirst({ where: { id: partyId, vendorId }, select: { id: true, name: true, phone: true, gstin: true, address: true } });
    if (!party) throw new NotFoundException('Customer or supplier not found.');
    const lines = await this.prisma.bosJournalLine.findMany({ where: { vendorId, partyId, accountCode: { in: [ACC.RECEIVABLES, ACC.CUSTOMER_ADVANCES, ACC.PAYABLES, ACC.SUPPLIER_ADVANCES] } }, include: { entry: true }, orderBy: [{ entry: { entryDate: 'asc' } }, { id: 'asc' }] });
    const fromD = from ? new Date(from) : null; const toD = to ? new Date(to) : null;
    let running = 0; let opening = 0;
    const rows: { date: Date; type: string; ref: string; debitPaise: number; creditPaise: number; balancePaise: number }[] = [];
    const ids = [...new Set(lines.map((l) => l.entry.sourceId.split(':')[0]))];
    const docs = await this.prisma.bosDocument.findMany({ where: { vendorId, id: { in: ids } }, select: { id: true, number: true } });
    const pays = await this.prisma.bosPayment.findMany({ where: { vendorId, id: { in: ids } }, select: { id: true, number: true } });
    const label = new Map<string, string>([...docs, ...pays].map((x) => [x.id, x.number ?? x.id]));
    for (const l of lines) {
      // customer side (receivables, customer advances): debit - credit = what they owe us. supplier side (payables, supplier advances): credit - debit = what we owe them.
      const effect = l.accountCode === ACC.RECEIVABLES || l.accountCode === ACC.CUSTOMER_ADVANCES ? l.debitPaise - l.creditPaise : l.creditPaise - l.debitPaise;
      const d = l.entry.entryDate;
      if (fromD && d < fromD) { opening += effect; running += effect; continue; }
      if (toD && d > toD) continue;
      running += effect;
      rows.push({ date: d, type: l.entry.sourceType, ref: label.get(l.entry.sourceId.split(':')[0]) ?? '', debitPaise: l.debitPaise, creditPaise: l.creditPaise, balancePaise: running });
    }
    return { party, openingPaise: opening, rows, closingPaise: running };
  }
}
