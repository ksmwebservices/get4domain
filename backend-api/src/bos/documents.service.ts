import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BosDocument, BosDocumentLine, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { BosSettingsService, DocType, NumberingService, PostingService, Tx } from './core.services';
import { BosStockService, MoveLine, NegativePolicy, costPaiseOf } from './bos-stock.service';
import { DocumentTotals, LineInput, TaxContext, computeDocument, financialYear, isIntraState, toPaise } from './gst';
import { creditNoteLines, purchaseBillLines, salesInvoiceLines } from './posting-rules';

export interface DocLineInput {
  itemId?: string;
  name?: string;
  description?: string;
  variantKey?: string;
  hsn?: string;
  unit?: string;
  qty: number;
  /** Rupees per unit, as entered. Omitted = the item's price. */
  rate?: number;
  /** Rupees off this line. */
  discount?: number;
  gstRate?: number;
  /** Credit notes: the invoice line being returned, and whether the goods go back on the shelf. */
  refLineId?: string;
  restock?: boolean;
}

export interface DocInput {
  docType: DocType;
  partyId?: string;
  partyName?: string;
  docDate?: string | Date;
  dueDate?: string | Date;
  taxKind?: 'GST' | 'NONE';
  priceMode?: 'EXCLUSIVE' | 'INCLUSIVE';
  /** Rupees. */
  discount?: number;
  shipping?: number;
  notes?: string;
  terms?: string;
  lines: DocLineInput[];
  refDocId?: string;
  supplierRef?: string;
  source?: string;
  sourceType?: string;
  sourceId?: string;
  idempotencyKey?: string;
  /** Round the total to the nearest rupee (default: the vendor's setting). */
  roundOff?: boolean;
}

export interface IssueOptions {
  actor?: string;
  /** The stock already left the shelf when a website order was placed: bill it, do not take it twice. */
  stockAlreadyMoved?: boolean;
  policy?: NegativePolicy;
}

export type DocWithLines = BosDocument & { lines: BosDocumentLine[] };
export interface IssueResult { doc: DocWithLines; warnings: string[]; replayed: boolean }

const SALES_LIKE: DocType[] = ['QUOTE', 'SALES_ORDER', 'SALES_INVOICE', 'CREDIT_NOTE'];
const OPEN_STATES = ['ISSUED', 'PART_PAID'];

/** Parses the rupee price a catalogue item carries ("₹1,299", 1299). */
export function itemRupees(p: { priceAmount: number | null; price: string | null }): number | null {
  if (p.priceAmount != null) return p.priceAmount;
  const m = (p.price ?? '').match(/([0-9][0-9,]*(?:\.[0-9]{1,2})?)/);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

const asDate = (d: string | Date | undefined, fallback: Date = new Date()): Date => {
  if (!d) return fallback;
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) throw new BadRequestException('That date does not look right.');
  return x;
};

/**
 * Business documents: quote, sales order, sales invoice, credit note, purchase bill. A document is DRAFT (editable, no number, no effects)
 * until issued. Issuing assigns the gapless number, moves stock and posts the journal, all in ONE transaction. After issue nothing is edited
 * or deleted: a cancellation posts a reversal, a correction is a credit note.
 */
@Injectable()
export class BosDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: BosSettingsService,
    private readonly numbering: NumberingService,
    private readonly posting: PostingService,
    private readonly stock: BosStockService,
  ) {}

  // ── Building ─────────────────────────────────────────────────────────────────────────────────────

  /** Resolve the party, tax context, line defaults from items, and compute every amount. */
  private async build(db: Prisma.TransactionClient | PrismaService, vendorId: string, input: DocInput) {
    const s = await this.settings.get(vendorId, db);
    if (!input.lines?.length) throw new BadRequestException('Add at least one item.');
    if (input.lines.length > 200) throw new BadRequestException('A document can have up to 200 lines.');
    const taxKind = input.taxKind ?? (s.gstRegistered ? 'GST' : 'NONE');
    if (taxKind === 'GST' && !s.gstRegistered) throw new BadRequestException('Add your GSTIN in Accounts settings before issuing a tax invoice, or issue a bill of supply (no GST).');
    const priceMode = (input.priceMode ?? s.priceMode) as 'EXCLUSIVE' | 'INCLUSIVE';

    let party: { id: string; name: string; gstin: string | null; state: string | null; address: string | null } | null = null;
    if (input.partyId) {
      const c = await db.contact.findFirst({ where: { id: input.partyId, vendorId }, select: { id: true, name: true, gstin: true, state: true, address: true } });
      if (!c) throw new BadRequestException('That customer or supplier was not found.');
      party = { ...c };
    }
    if (input.docType === 'PURCHASE_BILL' && !party) throw new BadRequestException('Choose the supplier for a purchase bill.');
    const intraState = isIntraState(s.state, party?.state);

    const itemIds = [...new Set(input.lines.map((l) => l.itemId).filter(Boolean))] as string[];
    const items = itemIds.length ? await db.vendorProduct.findMany({ where: { id: { in: itemIds }, vendorId } }) : [];
    const byId = new Map(items.map((i) => [i.id, i]));

    const lineRows = input.lines.map((l, idx) => {
      const item = l.itemId ? byId.get(l.itemId) : undefined;
      if (l.itemId && !item) throw new BadRequestException('One of the items on this document no longer exists.');
      const name = (l.name ?? item?.name ?? '').trim();
      if (!name) throw new BadRequestException(`Line ${idx + 1} needs an item or a name.`);
      let rate = l.rate;
      if (rate == null) {
        if (input.docType === 'PURCHASE_BILL' && item?.purchasePriceAmount != null) rate = item.purchasePriceAmount;
        else if (item) rate = itemRupees(item) ?? undefined;
      }
      if (rate == null || !Number.isFinite(rate) || rate < 0) throw new BadRequestException(`Line ${idx + 1} (${name}) needs a price.`);
      if (!Number.isFinite(l.qty) || !(l.qty > 0)) throw new BadRequestException(`Line ${idx + 1} (${name}) needs a quantity above zero.`);
      const gstRate = taxKind === 'GST' ? (l.gstRate ?? item?.gstRate ?? s.defaultGstRate) : 0;
      const li: LineInput = { qty: l.qty, ratePaise: toPaise(rate), discountPaise: l.discount ? toPaise(l.discount) : 0, gstRate };
      return { src: l, item, name, li };
    });

    let totals: DocumentTotals;
    try {
      totals = computeDocument(lineRows.map((r) => r.li), { taxKind, priceMode, intraState } as TaxContext, {
        discountPaise: input.discount ? toPaise(input.discount) : 0, shippingPaise: input.shipping ? toPaise(input.shipping) : 0,
        shippingGstRate: taxKind === 'GST' ? s.defaultGstRate : 0, roundOff: input.roundOff ?? s.roundOff,
      });
    } catch (e) { throw new BadRequestException(e instanceof RangeError ? e.message : 'Those amounts do not add up.'); }

    return { s, taxKind, priceMode, party, intraState, lineRows, totals };
  }

  private headerData(vendorId: string, input: DocInput, b: Awaited<ReturnType<BosDocumentsService['build']>>, docDate: Date, actor?: string): Prisma.BosDocumentUncheckedCreateInput {
    return {
      vendorId, docType: input.docType, status: 'DRAFT', partyId: b.party?.id ?? null, partyName: b.party?.name ?? input.partyName?.trim() ?? null,
      partyGstin: b.party?.gstin ?? null, partyState: b.party?.state ?? null, billingAddress: b.party?.address ?? null,
      docDate, dueDate: input.dueDate ? asDate(input.dueDate) : null, taxKind: b.taxKind, priceMode: b.priceMode,
      placeOfSupply: b.party?.state ?? b.s.state ?? null, intraState: b.intraState,
      subtotalPaise: b.totals.subtotalPaise, discountPaise: b.totals.discountPaise, shippingPaise: b.totals.shippingPaise,
      taxablePaise: b.totals.taxablePaise, cgstPaise: b.totals.cgstPaise, sgstPaise: b.totals.sgstPaise, igstPaise: b.totals.igstPaise,
      roundOffPaise: b.totals.roundOffPaise, totalPaise: b.totals.totalPaise,
      source: input.source ?? 'MANUAL', sourceType: input.sourceType ?? null, sourceId: input.sourceId ?? null, refDocId: input.refDocId ?? null,
      supplierRef: input.supplierRef?.trim().slice(0, 60) ?? null, notes: input.notes?.trim().slice(0, 1000) ?? null, terms: input.terms?.trim().slice(0, 1000) ?? b.s.terms,
      idempotencyKey: input.idempotencyKey ?? null, createdBy: actor ?? null,
    };
  }

  private lineData(vendorId: string, b: Awaited<ReturnType<BosDocumentsService['build']>>): Omit<Prisma.BosDocumentLineUncheckedCreateInput, 'documentId'>[] {
    return b.lineRows.map((r, i) => {
      const t = b.totals.lines[i];
      const tracked = Boolean(r.item?.trackStock);
      return {
        vendorId, lineNo: i + 1, itemId: r.item?.id ?? null, name: r.name, description: r.src.description?.trim().slice(0, 300) ?? null, variantKey: r.src.variantKey?.trim() || null,
        hsn: r.src.hsn?.trim() || r.item?.hsn || null, unit: r.src.unit?.trim() || r.item?.unit || null, qty: r.li.qty, ratePaise: r.li.ratePaise, discountPaise: r.li.discountPaise ?? 0,
        taxablePaise: t.taxablePaise, gstRate: r.li.gstRate, cgstPaise: t.cgstPaise, sgstPaise: t.sgstPaise, igstPaise: t.igstPaise, totalPaise: t.totalPaise,
        unitCostPaise: tracked ? costPaiseOf(r.item?.purchasePriceAmount) : null, stockQty: 0, refLineId: r.src.refLineId ?? null, restock: r.src.restock ?? true,
      };
    });
  }

  // ── Drafts ───────────────────────────────────────────────────────────────────────────────────────

  /** The exact totals a document would get (tax split, round off), without saving anything. The screens show this, so the customer is never quoted a different number than the one issued. */
  async preview(vendorId: string, input: DocInput): Promise<{ subtotalPaise: number; discountPaise: number; shippingPaise: number; taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; roundOffPaise: number; totalPaise: number; taxKind: string; priceMode: string; intraState: boolean }> {
    const b = await this.build(this.prisma, vendorId, input);
    const t = b.totals;
    return { subtotalPaise: t.subtotalPaise, discountPaise: t.discountPaise, shippingPaise: t.shippingPaise, taxablePaise: t.taxablePaise, cgstPaise: t.cgstPaise, sgstPaise: t.sgstPaise, igstPaise: t.igstPaise, roundOffPaise: t.roundOffPaise, totalPaise: t.totalPaise, taxKind: b.taxKind, priceMode: b.priceMode, intraState: b.intraState };
  }

  async createDraft(vendorId: string, input: DocInput, actor?: string, db: Tx | PrismaService = this.prisma): Promise<DocWithLines> {
    if (input.idempotencyKey) {
      const found = await db.bosDocument.findUnique({ where: { vendorId_idempotencyKey: { vendorId, idempotencyKey: input.idempotencyKey } }, include: { lines: { orderBy: { lineNo: 'asc' } } } });
      if (found) return found;
    }
    const b = await this.build(db, vendorId, input);
    const docDate = asDate(input.docDate);
    await this.settings.assertOpen(vendorId, docDate, db);
    return db.bosDocument.create({ data: { ...this.headerData(vendorId, input, b, docDate, actor), lines: { create: this.lineData(vendorId, b) } }, include: { lines: { orderBy: { lineNo: 'asc' } } } });
  }

  async updateDraft(vendorId: string, id: string, input: DocInput, actor?: string): Promise<DocWithLines> {
    const cur = await this.getRaw(vendorId, id);
    if (cur.status !== 'DRAFT') throw new ConflictException('An issued document cannot be edited. Cancel it, or issue a credit note.');
    const b = await this.build(this.prisma, vendorId, { ...input, docType: cur.docType as DocType });
    const docDate = asDate(input.docDate, cur.docDate);
    await this.settings.assertOpen(vendorId, docDate);
    const { vendorId: _v, docType: _t, status: _s, createdBy: _c, idempotencyKey: _k, ...head } = this.headerData(vendorId, { ...input, docType: cur.docType as DocType }, b, docDate, actor);
    void _v; void _t; void _s; void _c; void _k;
    return this.prisma.$transaction(async (tx) => {
      await tx.bosDocumentLine.deleteMany({ where: { documentId: id } });
      return tx.bosDocument.update({ where: { id }, data: { ...head, lines: { create: this.lineData(vendorId, b) } }, include: { lines: { orderBy: { lineNo: 'asc' } } } });
    });
  }

  async deleteDraft(vendorId: string, id: string): Promise<{ deleted: true }> {
    const cur = await this.getRaw(vendorId, id);
    if (cur.status !== 'DRAFT') throw new ConflictException('Only a draft can be deleted. An issued document is cancelled instead.');
    await this.prisma.bosDocument.delete({ where: { id } }); // a draft never had a number, stock or journal entry
    return { deleted: true };
  }

  // ── Reads ────────────────────────────────────────────────────────────────────────────────────────

  async getRaw(vendorId: string, id: string): Promise<DocWithLines> {
    const d = await this.prisma.bosDocument.findFirst({ where: { id, vendorId }, include: { lines: { orderBy: { lineNo: 'asc' } } } });
    if (!d) throw new NotFoundException('Document not found.');
    return d;
  }

  async get(vendorId: string, id: string) {
    const d = await this.getRaw(vendorId, id);
    const allocations = await this.prisma.bosAllocation.findMany({ where: { vendorId, documentId: id }, orderBy: { createdAt: 'asc' } });
    const paymentIds = allocations.map((a) => a.paymentId).filter(Boolean) as string[];
    const payments = paymentIds.length ? await this.prisma.bosPayment.findMany({ where: { vendorId, id: { in: paymentIds } } }) : [];
    const credits = d.docType === 'SALES_INVOICE' ? await this.prisma.bosDocument.findMany({ where: { vendorId, docType: 'CREDIT_NOTE', refDocId: id, status: { not: 'CANCELLED' } }, select: { id: true, number: true, totalPaise: true, docDate: true } }) : [];
    return { ...d, outstandingPaise: Math.max(0, d.totalPaise - d.paidPaise), allocations, payments, credits };
  }

  async list(vendorId: string, q: { docType: DocType; status?: string; partyId?: string; from?: string; to?: string; search?: string; take?: number; skip?: number }) {
    const where: Prisma.BosDocumentWhereInput = { vendorId, docType: q.docType };
    if (q.status === 'OPEN') where.status = { in: OPEN_STATES };
    else if (q.status) where.status = q.status;
    if (q.partyId) where.partyId = q.partyId;
    if (q.from || q.to) where.docDate = { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) };
    if (q.search) where.OR = [{ number: { contains: q.search, mode: 'insensitive' } }, { partyName: { contains: q.search, mode: 'insensitive' } }];
    const [rows, total] = await Promise.all([
      this.prisma.bosDocument.findMany({ where, orderBy: [{ docDate: 'desc' }, { createdAt: 'desc' }], take: Math.min(q.take ?? 50, 200), skip: q.skip ?? 0 }),
      this.prisma.bosDocument.count({ where }),
    ]);
    return { rows: rows.map((r) => ({ ...r, outstandingPaise: ['ISSUED', 'PART_PAID'].includes(r.status) ? r.totalPaise - r.paidPaise : 0 })), total };
  }

  // ── Issue ────────────────────────────────────────────────────────────────────────────────────────

  /** Create and issue in one step (counter sale, order bridge, recurring). Idempotent when `idempotencyKey` or a source is given. */
  async createAndIssue(vendorId: string, input: DocInput, opts: IssueOptions = {}): Promise<IssueResult> {
    const run = async (): Promise<IssueResult> => {
      if (input.idempotencyKey) {
        const found = await this.prisma.bosDocument.findUnique({ where: { vendorId_idempotencyKey: { vendorId, idempotencyKey: input.idempotencyKey } }, include: { lines: { orderBy: { lineNo: 'asc' } } } });
        if (found && found.status !== 'DRAFT') return { doc: found, warnings: [], replayed: true };
      }
      if (input.sourceType && input.sourceId) {
        const found = await this.prisma.bosDocument.findFirst({ where: { vendorId, docType: input.docType, sourceType: input.sourceType, sourceId: input.sourceId }, include: { lines: { orderBy: { lineNo: 'asc' } } } });
        if (found && found.status !== 'DRAFT') return { doc: found, warnings: [], replayed: true };
      }
      const draft = await this.createDraft(vendorId, input, opts.actor);
      return this.issue(vendorId, draft.id, opts);
    };
    try { return await run(); } catch (e) {
      // a racing duplicate (same key / same order): the loser rolled back — hand back the winner's document
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const again = input.idempotencyKey
          ? await this.prisma.bosDocument.findUnique({ where: { vendorId_idempotencyKey: { vendorId, idempotencyKey: input.idempotencyKey } }, include: { lines: { orderBy: { lineNo: 'asc' } } } })
          : await this.prisma.bosDocument.findFirst({ where: { vendorId, docType: input.docType, sourceType: input.sourceType ?? '', sourceId: input.sourceId ?? '' }, include: { lines: { orderBy: { lineNo: 'asc' } } } });
        if (again) return { doc: again, warnings: [], replayed: true };
      }
      throw e;
    }
  }

  async issue(vendorId: string, id: string, opts: IssueOptions = {}): Promise<IssueResult> {
    return this.prisma.$transaction((tx) => this.issueIn(tx, vendorId, id, opts));
  }

  /** The issue steps inside a caller's transaction (the counter sale issues the invoice AND records the payment in one). */
  async issueIn(tx: Tx, vendorId: string, id: string, opts: IssueOptions = {}): Promise<IssueResult> {
    const cur = await this.getRawTx(tx, vendorId, id);
    if (cur.status !== 'DRAFT') return { doc: cur, warnings: [], replayed: true };
    const s = await this.settings.get(vendorId, tx);
    const policy = opts.policy ?? (s.negativeStock as NegativePolicy);
    const type = cur.docType as DocType;
    const warnings: string[] = [];

    const doc = await (async () => {
      const claim = await tx.bosDocument.updateMany({ where: { id, vendorId, status: 'DRAFT' }, data: { status: 'ISSUED' } });
      if (claim.count === 0) throw new ConflictException('This document was just issued by someone else.');
      await this.settings.assertOpen(vendorId, cur.docDate, tx);
      const { number, fy } = await this.numbering.next(tx, vendorId, type, cur.docDate);
      const lines = await tx.bosDocumentLine.findMany({ where: { documentId: id }, orderBy: { lineNo: 'asc' } });
      const token = randomBytes(24).toString('hex');
      let status = 'ISSUED';

      if (type === 'SALES_INVOICE') {
        const moves: MoveLine[] = lines.filter((l) => l.itemId).map((l) => ({ productId: l.itemId as string, qty: l.qty, variantKey: l.variantKey }));
        const res = opts.stockAlreadyMoved
          ? { unitCostPaise: new Map<string, number | null>(), moved: new Set<string>(), warnings: [] as string[] } // nothing moves: costs are read below
          : await this.stock.sale(tx, vendorId, moves, { type: 'BOS_DOC', id }, `bos:${id}`, policy, opts.actor);
        warnings.push(...res.warnings);
        const costs = res.unitCostPaise;
        let cogs = 0;
        for (const l of lines) {
          if (!l.itemId) continue;
          const item = await tx.vendorProduct.findUnique({ where: { id: l.itemId }, select: { trackStock: true, purchasePriceAmount: true } });
          const unitCost = item?.trackStock ? (costs.get(l.itemId) ?? costPaiseOf(item.purchasePriceAmount)) : null;
          const moved = !opts.stockAlreadyMoved && item?.trackStock ? l.qty : 0;
          await tx.bosDocumentLine.update({ where: { id: l.id }, data: { unitCostPaise: unitCost, stockQty: moved } });
          if (unitCost != null) cogs += Math.round(l.qty * unitCost);
        }
        await this.posting.post(tx, {
          vendorId, sourceType: 'SALES_INVOICE', sourceId: id, date: cur.docDate, memo: `Invoice ${number}`,
          lines: salesInvoiceLines({ partyId: cur.partyId, taxablePaise: cur.taxablePaise, cgstPaise: cur.cgstPaise, sgstPaise: cur.sgstPaise, igstPaise: cur.igstPaise, roundOffPaise: cur.roundOffPaise, totalPaise: cur.totalPaise, cogsPaise: cogs }),
        });
      } else if (type === 'CREDIT_NOTE') {
        const inv = cur.refDocId ? await tx.bosDocument.findFirst({ where: { id: cur.refDocId, vendorId, docType: 'SALES_INVOICE' } }) : null;
        if (!inv || inv.status === 'CANCELLED' || inv.status === 'DRAFT') throw new BadRequestException('A credit note needs an issued invoice to credit.');
        const back: MoveLine[] = lines.filter((l) => l.itemId && l.restock).map((l) => ({ productId: l.itemId as string, qty: l.qty, variantKey: l.variantKey }));
        const res = await this.stock.add(tx, vendorId, back, { type: 'BOS_DOC', id }, `bos:${id}`, 'RETURN', opts.actor);
        let restockedCost = 0;
        for (const l of lines) {
          if (!l.itemId || !l.restock || !res.moved.has(l.itemId)) continue;
          const orig = l.refLineId ? await tx.bosDocumentLine.findUnique({ where: { id: l.refLineId } }) : null;
          const unit = orig?.unitCostPaise ?? res.unitCostPaise.get(l.itemId) ?? null;
          await tx.bosDocumentLine.update({ where: { id: l.id }, data: { unitCostPaise: unit, stockQty: l.qty } });
          if (unit != null) restockedCost += Math.round(l.qty * unit);
        }
        await this.posting.post(tx, {
          vendorId, sourceType: 'CREDIT_NOTE', sourceId: id, date: cur.docDate, memo: `Credit note ${number}`,
          lines: creditNoteLines({ partyId: cur.partyId, taxablePaise: cur.taxablePaise, cgstPaise: cur.cgstPaise, sgstPaise: cur.sgstPaise, igstPaise: cur.igstPaise, roundOffPaise: cur.roundOffPaise, totalPaise: cur.totalPaise, restockedCostPaise: restockedCost }),
        });
        // the credit reduces what the customer owes on that invoice (any excess stays as a credit on their account)
        const outstanding = Math.max(0, inv.totalPaise - inv.paidPaise);
        const apply = Math.min(cur.totalPaise, outstanding);
        if (apply > 0) {
          await tx.bosAllocation.create({ data: { vendorId, documentId: inv.id, creditNoteId: id, amountPaise: apply } });
          await this.recomputePaid(tx, vendorId, inv.id);
        }
        status = 'PAID'; // a credit note is a settled document
        await tx.bosDocument.update({ where: { id }, data: { paidPaise: cur.totalPaise } });
      } else if (type === 'PURCHASE_BILL') {
        const stockLines = [] as { l: typeof lines[number]; taxable: number }[];
        for (const l of lines) {
          if (!l.itemId) continue;
          const item = await tx.vendorProduct.findUnique({ where: { id: l.itemId }, select: { trackStock: true } });
          if (item?.trackStock) stockLines.push({ l, taxable: l.taxablePaise });
        }
        const recv: MoveLine[] = stockLines.map((x) => ({ productId: x.l.itemId as string, qty: x.l.qty, variantKey: x.l.variantKey }));
        await this.stock.add(tx, vendorId, recv, { type: 'BOS_DOC', id }, `bos:${id}`, 'PURCHASE', opts.actor);
        for (const x of stockLines) {
          await tx.bosDocumentLine.update({ where: { id: x.l.id }, data: { stockQty: x.l.qty } });
          if (s.purchaseUpdatesCost && x.l.qty > 0) await tx.vendorProduct.updateMany({ where: { id: x.l.itemId as string, vendorId }, data: { purchasePriceAmount: Math.round(x.taxable / x.l.qty) / 100 } });
        }
        await this.posting.post(tx, {
          vendorId, sourceType: 'PURCHASE_BILL', sourceId: id, date: cur.docDate, memo: `Purchase bill ${number}`,
          lines: purchaseBillLines({ partyId: cur.partyId, taxablePaise: cur.taxablePaise, cgstPaise: cur.cgstPaise, sgstPaise: cur.sgstPaise, igstPaise: cur.igstPaise, roundOffPaise: cur.roundOffPaise, totalPaise: cur.totalPaise, stockTaxablePaise: stockLines.reduce((a, x) => a + x.taxable, 0) }),
        });
      }
      // quotes and sales orders have no stock or journal effect
      await tx.bosDocument.update({ where: { id }, data: { number, fy, status, issuedAt: new Date(), publicToken: SALES_LIKE.includes(type) ? token : null } });
      return tx.bosDocument.findUniqueOrThrow({ where: { id }, include: { lines: { orderBy: { lineNo: 'asc' } } } });
    })();
    return { doc, warnings, replayed: false };
  }

  // ── Cancel ───────────────────────────────────────────────────────────────────────────────────────

  async cancel(vendorId: string, id: string, reason: string, actor?: string): Promise<DocWithLines> {
    if ((reason ?? '').trim().length < 3) throw new BadRequestException('Say why you are cancelling it (a few words).');
    const cur = await this.getRaw(vendorId, id);
    if (cur.status === 'CANCELLED') return cur;
    if (cur.status === 'DRAFT') throw new ConflictException('A draft is deleted, not cancelled.');
    const type = cur.docType as DocType;
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await this.settings.assertOpen(vendorId, cur.docDate, tx);
      if (['SALES_INVOICE', 'PURCHASE_BILL'].includes(type)) {
        const used = await tx.bosAllocation.count({ where: { vendorId, documentId: id, payment: { is: { status: 'ACTIVE' } } } }) + await tx.bosAllocation.count({ where: { vendorId, documentId: id, creditNoteId: { not: null } } });
        if (used > 0) throw new ConflictException('This document has payments or credit notes against it. Cancel those first, or issue a credit note instead.');
      }
      if (type === 'CREDIT_NOTE') {
        // taking a credit note back re-opens the invoice it reduced
        await tx.bosAllocation.deleteMany({ where: { vendorId, creditNoteId: id } });
        if (cur.refDocId) await this.recomputePaid(tx, vendorId, cur.refDocId);
      }
      const claim = await tx.bosDocument.updateMany({ where: { id, vendorId, status: { not: 'CANCELLED' } }, data: { status: 'CANCELLED', cancelledAt: now, cancelReason: reason.trim().slice(0, 200) } });
      if (claim.count === 0) return this.getRawTx(tx, vendorId, id);
      const movedLines = cur.lines.filter((l) => l.itemId && l.stockQty > 0).map((l) => ({ productId: l.itemId as string, qty: l.stockQty, variantKey: l.variantKey }));
      if (movedLines.length) {
        if (type === 'SALES_INVOICE' || type === 'PURCHASE_BILL') {
          // a cancelled sale puts the goods back; a cancelled purchase takes them out again (never below what is on the shelf)
          if (type === 'SALES_INVOICE') await this.stock.add(tx, vendorId, movedLines, { type: 'BOS_DOC', id }, `bosx:${id}`, 'CANCEL', actor);
          else await this.stock.sale(tx, vendorId, movedLines, { type: 'BOS_DOC', id }, `bosx:${id}`, 'ALLOW', actor, 'ADJUSTMENT');
        } else if (type === 'CREDIT_NOTE') {
          await this.stock.sale(tx, vendorId, movedLines, { type: 'BOS_DOC', id }, `bosx:${id}`, 'ALLOW', actor, 'ADJUSTMENT');
        }
      }
      if (['SALES_INVOICE', 'CREDIT_NOTE', 'PURCHASE_BILL'].includes(type)) await this.posting.reverse(tx, vendorId, type, id, now, `Cancelled: ${reason.trim()}`);
      return this.getRawTx(tx, vendorId, id);
    });
  }

  private async getRawTx(tx: Tx, vendorId: string, id: string): Promise<DocWithLines> {
    return tx.bosDocument.findFirstOrThrow({ where: { id, vendorId }, include: { lines: { orderBy: { lineNo: 'asc' } } } });
  }

  /** paidPaise and status from the live allocations (active payments + credit notes). */
  async recomputePaid(tx: Tx, vendorId: string, documentId: string): Promise<void> {
    const doc = await tx.bosDocument.findFirst({ where: { id: documentId, vendorId } });
    if (!doc || doc.status === 'CANCELLED' || doc.status === 'DRAFT') return;
    const allocs = await tx.bosAllocation.findMany({ where: { vendorId, documentId }, include: { payment: true } });
    const paid = allocs.reduce((a, x) => a + (x.payment && x.payment.status !== 'ACTIVE' ? 0 : x.amountPaise), 0);
    const status = paid <= 0 ? 'ISSUED' : paid >= doc.totalPaise ? 'PAID' : 'PART_PAID';
    await tx.bosDocument.update({ where: { id: documentId }, data: { paidPaise: paid, status } });
  }

  // ── Conversions ──────────────────────────────────────────────────────────────────────────────────

  /** Quote or sales order → a new sales invoice draft carrying the same lines. The source is marked CONVERTED. */
  async convert(vendorId: string, id: string, to: 'SALES_ORDER' | 'SALES_INVOICE', actor?: string): Promise<DocWithLines> {
    const src = await this.getRaw(vendorId, id);
    if (!['QUOTE', 'SALES_ORDER'].includes(src.docType)) throw new BadRequestException('Only a quote or a sales order can be converted.');
    if (src.status === 'DRAFT' || src.status === 'CANCELLED' || src.status === 'REJECTED') throw new ConflictException('Issue the quote first (and it must not be cancelled or rejected).');
    if (src.status === 'CONVERTED') throw new ConflictException('This has already been converted.');
    if (to === 'SALES_ORDER' && src.docType !== 'QUOTE') throw new BadRequestException('Only a quote becomes a sales order.');
    const draft = await this.createDraft(vendorId, {
      docType: to, partyId: src.partyId ?? undefined, partyName: src.partyName ?? undefined, taxKind: src.taxKind as 'GST' | 'NONE', priceMode: src.priceMode as 'EXCLUSIVE' | 'INCLUSIVE',
      discount: src.discountPaise / 100, shipping: src.shippingPaise / 100, notes: src.notes ?? undefined, terms: src.terms ?? undefined, refDocId: src.id, source: 'QUOTE',
      lines: src.lines.map((l) => ({ itemId: l.itemId ?? undefined, name: l.name, description: l.description ?? undefined, variantKey: l.variantKey ?? undefined, hsn: l.hsn ?? undefined, unit: l.unit ?? undefined, qty: l.qty, rate: l.ratePaise / 100, discount: l.discountPaise / 100, gstRate: l.gstRate })),
    }, actor);
    await this.prisma.bosDocument.update({ where: { id }, data: { status: 'CONVERTED' } });
    return draft;
  }

  async setQuoteStatus(vendorId: string, id: string, status: 'ACCEPTED' | 'REJECTED'): Promise<DocWithLines> {
    const d = await this.getRaw(vendorId, id);
    if (d.docType !== 'QUOTE' || !['ISSUED', 'ACCEPTED', 'REJECTED'].includes(d.status)) throw new ConflictException('Only a sent quote can be marked accepted or rejected.');
    await this.prisma.bosDocument.update({ where: { id }, data: { status } });
    return this.getRaw(vendorId, id);
  }

  /** A credit note draft for part or all of an invoice, from what has NOT been credited yet. */
  async creditNoteFor(vendorId: string, invoiceId: string, input: { lines?: { refLineId: string; qty: number; restock?: boolean }[]; reason?: string; docDate?: string }, actor?: string): Promise<DocWithLines> {
    const inv = await this.getRaw(vendorId, invoiceId);
    if (inv.docType !== 'SALES_INVOICE' || inv.status === 'DRAFT' || inv.status === 'CANCELLED') throw new BadRequestException('A credit note needs an issued invoice.');
    const credited = await this.prisma.bosDocumentLine.findMany({ where: { vendorId, refLineId: { in: inv.lines.map((l) => l.id) }, document: { is: { docType: 'CREDIT_NOTE', status: { not: 'CANCELLED' } } } } });
    const takenBy = new Map<string, number>();
    for (const c of credited) takenBy.set(c.refLineId as string, (takenBy.get(c.refLineId as string) ?? 0) + c.qty);
    const wanted = input.lines?.length ? input.lines : inv.lines.map((l) => ({ refLineId: l.id, qty: l.qty - (takenBy.get(l.id) ?? 0), restock: true }));
    const out: DocLineInput[] = [];
    for (const w of wanted) {
      const orig = inv.lines.find((l) => l.id === w.refLineId);
      if (!orig) throw new BadRequestException('That line is not on this invoice.');
      const left = orig.qty - (takenBy.get(orig.id) ?? 0);
      if (w.qty <= 0) continue;
      if (w.qty > left + 1e-9) throw new BadRequestException(`"${orig.name}": only ${left} left to credit (the rest was returned before).`);
      // price the credit exactly as the sale was charged: the line's own net of discount, per unit, in the document's price mode
      const perUnitEntered = Math.round((orig.taxablePaise + (inv.priceMode === 'INCLUSIVE' ? orig.cgstPaise + orig.sgstPaise + orig.igstPaise : 0)) / orig.qty);
      out.push({ itemId: orig.itemId ?? undefined, name: orig.name, description: orig.description ?? undefined, variantKey: orig.variantKey ?? undefined, hsn: orig.hsn ?? undefined, unit: orig.unit ?? undefined, qty: w.qty, rate: perUnitEntered / 100, gstRate: orig.gstRate, refLineId: orig.id, restock: w.restock ?? true });
    }
    if (!out.length) throw new BadRequestException('There is nothing left to credit on this invoice.');
    return this.createDraft(vendorId, { docType: 'CREDIT_NOTE', partyId: inv.partyId ?? undefined, partyName: inv.partyName ?? undefined, taxKind: inv.taxKind as 'GST' | 'NONE', priceMode: inv.priceMode as 'EXCLUSIVE' | 'INCLUSIVE', refDocId: inv.id, docDate: input.docDate, notes: input.reason, roundOff: false, lines: out }, actor);
  }
}

export { financialYear };
