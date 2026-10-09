import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BosSettings, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_ACCOUNTS } from './chart';
import { DraftLine, assertBalanced, reverseLines } from './posting-rules';
import { financialYear } from './gst';

export type Tx = Prisma.TransactionClient;
export type Db = Tx | PrismaService;

export type DocType = 'QUOTE' | 'SALES_ORDER' | 'SALES_INVOICE' | 'CREDIT_NOTE' | 'PURCHASE_BILL';
export type SeriesType = DocType | 'RECEIPT' | 'PAYMENT_OUT' | 'EXPENSE';

export const DEFAULT_PREFIX: Record<SeriesType, string> = {
  QUOTE: 'QT', SALES_ORDER: 'SO', SALES_INVOICE: 'INV', CREDIT_NOTE: 'CN', PURCHASE_BILL: 'PB', RECEIPT: 'RCT', PAYMENT_OUT: 'PAY', EXPENSE: 'EXP',
};

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const validGstin = (g: string): boolean => GSTIN_RE.test(g.trim().toUpperCase());

/** Vendor BOS settings, created on first use. */
@Injectable()
export class BosSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(vendorId: string, db: Db = this.prisma): Promise<BosSettings> {
    const found = await db.bosSettings.findUnique({ where: { vendorId } });
    if (found) return found;
    try {
      return await db.bosSettings.create({ data: { vendorId } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return db.bosSettings.findUniqueOrThrow({ where: { vendorId } });
      throw e;
    }
  }

  async update(vendorId: string, input: Partial<Pick<BosSettings, 'gstRegistered' | 'gstin' | 'legalName' | 'state' | 'defaultGstRate' | 'priceMode' | 'roundOff' | 'negativeStock' | 'orderInvoiceOn' | 'purchaseUpdatesCost' | 'bankDetails' | 'upiId' | 'terms' | 'notes'>> & { prefixes?: Record<string, string> }): Promise<BosSettings> {
    await this.get(vendorId);
    const data: Prisma.BosSettingsUpdateInput = {};
    if (input.gstin !== undefined) {
      const g = (input.gstin ?? '').trim().toUpperCase();
      if (g && !validGstin(g)) throw new BadRequestException('That GSTIN does not look right. It has 15 characters, for example 33ABCDE1234F1Z5.');
      data.gstin = g || null;
    }
    if (input.gstRegistered !== undefined) data.gstRegistered = Boolean(input.gstRegistered);
    if (input.legalName !== undefined) data.legalName = (input.legalName ?? '').trim().slice(0, 120) || null;
    if (input.state !== undefined) data.state = (input.state ?? '').trim().slice(0, 60) || null;
    if (input.defaultGstRate !== undefined) { if (!(input.defaultGstRate >= 0 && input.defaultGstRate <= 100)) throw new BadRequestException('GST rate must be between 0 and 100.'); data.defaultGstRate = input.defaultGstRate; }
    if (input.priceMode !== undefined) { if (!['EXCLUSIVE', 'INCLUSIVE'].includes(input.priceMode)) throw new BadRequestException('Choose whether your prices include GST or not.'); data.priceMode = input.priceMode; }
    if (input.roundOff !== undefined) data.roundOff = Boolean(input.roundOff);
    if (input.negativeStock !== undefined) { if (!['BLOCK', 'WARN', 'ALLOW'].includes(input.negativeStock)) throw new BadRequestException('Choose block, warn or allow.'); data.negativeStock = input.negativeStock; }
    if (input.orderInvoiceOn !== undefined) { if (!['PAID', 'CONFIRMED', 'OFF'].includes(input.orderInvoiceOn)) throw new BadRequestException('Choose when website orders create an invoice.'); data.orderInvoiceOn = input.orderInvoiceOn; }
    if (input.purchaseUpdatesCost !== undefined) data.purchaseUpdatesCost = Boolean(input.purchaseUpdatesCost);
    for (const k of ['bankDetails', 'upiId', 'terms', 'notes'] as const) if (input[k] !== undefined) data[k] = ((input[k] as string | null) ?? '').trim().slice(0, 600) || null;
    if (input.prefixes !== undefined) {
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(input.prefixes ?? {})) {
        if (!(k in DEFAULT_PREFIX)) continue;
        const p = String(v ?? '').trim().toUpperCase();
        if (p && !/^[A-Z0-9-]{1,12}$/.test(p)) throw new BadRequestException('A number prefix can use letters, digits and a dash, up to 12 characters.');
        if (p) clean[k] = p;
      }
      data.prefixes = clean as Prisma.InputJsonValue;
    }
    return this.prisma.bosSettings.update({ where: { vendorId }, data });
  }

  /** Period lock: nothing dated on or before `lockedUntil` may be created, changed or cancelled. */
  async assertOpen(vendorId: string, date: Date, db: Db = this.prisma): Promise<void> {
    const s = await this.get(vendorId, db);
    if (s.lockedUntil && date.getTime() <= s.lockedUntil.getTime()) {
      throw new ConflictException(`That date is in a locked period (locked up to ${s.lockedUntil.toISOString().slice(0, 10)}). Date it later, or issue a credit note or adjustment dated today.`);
    }
  }
}

/** Gapless numbering per vendor, per document type, per financial year. Always call inside the document's own transaction. */
@Injectable()
export class NumberingService {
  constructor(private readonly settings: BosSettingsService) {}

  async next(tx: Tx, vendorId: string, type: SeriesType, date: Date): Promise<{ number: string; fy: string }> {
    const fy = financialYear(date);
    await tx.bosDocSeries.createMany({ data: [{ vendorId, docType: type, fy, lastNumber: 0 }], skipDuplicates: true });
    const row = await tx.bosDocSeries.update({ where: { vendorId_docType_fy: { vendorId, docType: type, fy } }, data: { lastNumber: { increment: 1 } } });
    const s = await this.settings.get(vendorId, tx);
    const prefix = ((s.prefixes as Record<string, string> | null) ?? {})[type] ?? DEFAULT_PREFIX[type];
    return { number: `${prefix}/${fy}/${String(row.lastNumber).padStart(4, '0')}`, fy };
  }
}

/** Seeds the chart of accounts on first use. */
@Injectable()
export class ChartService {
  async ensure(db: Db, vendorId: string): Promise<void> {
    const n = await db.bosAccount.count({ where: { vendorId } });
    if (n >= DEFAULT_ACCOUNTS.length) return;
    await db.bosAccount.createMany({ data: DEFAULT_ACCOUNTS.map((a) => ({ vendorId, code: a.code, name: a.name, type: a.type, system: true })), skipDuplicates: true });
  }
}

export interface PostInput {
  vendorId: string;
  sourceType: string;
  sourceId: string;
  version?: number;
  date: Date;
  memo?: string;
  lines: DraftLine[];
}

/** Writes balanced journal entries. Idempotent per (vendor, sourceType, sourceId, version); cancellation posts a reversal. */
@Injectable()
export class PostingService {
  constructor(private readonly chart: ChartService, private readonly settings: BosSettingsService) {}

  async post(tx: Tx, input: PostInput): Promise<{ entryId: string | null; replayed: boolean }> {
    const version = input.version ?? 1;
    const lines = assertBalanced(input.lines);
    if (lines.length === 0) return { entryId: null, replayed: false }; // nothing to post (e.g. a ₹0 document)
    const existing = await tx.bosJournalEntry.findUnique({ where: { vendorId_sourceType_sourceId_sourceVersion: { vendorId: input.vendorId, sourceType: input.sourceType, sourceId: input.sourceId, sourceVersion: version } }, select: { id: true } });
    if (existing) return { entryId: existing.id, replayed: true };
    await this.chart.ensure(tx, input.vendorId);
    const e = await tx.bosJournalEntry.create({
      data: {
        vendorId: input.vendorId, entryDate: input.date, sourceType: input.sourceType, sourceId: input.sourceId, sourceVersion: version, memo: input.memo,
        lines: { create: lines.map((l) => ({ vendorId: input.vendorId, accountCode: l.accountCode, partyId: l.partyId ?? null, debitPaise: l.debitPaise, creditPaise: l.creditPaise })) },
      },
    });
    return { entryId: e.id, replayed: false };
  }

  /** Cancels a posted source by posting the exact opposite entry (never deleting anything). Idempotent. */
  async reverse(tx: Tx, vendorId: string, sourceType: string, sourceId: string, date: Date, memo?: string): Promise<{ reversed: boolean }> {
    const originals = await tx.bosJournalEntry.findMany({ where: { vendorId, sourceType, sourceId, reversalOfId: null }, include: { lines: true } });
    if (originals.length === 0) return { reversed: false };
    let reversed = false;
    for (const o of originals) {
      const done = await tx.bosJournalEntry.findFirst({ where: { vendorId, reversalOfId: o.id }, select: { id: true } });
      if (done) continue;
      const lines = reverseLines(o.lines.map((l) => ({ accountCode: l.accountCode, partyId: l.partyId, debitPaise: l.debitPaise, creditPaise: l.creditPaise })));
      await tx.bosJournalEntry.create({
        data: {
          vendorId, entryDate: date, sourceType, sourceId, sourceVersion: o.sourceVersion + 1000, reversalOfId: o.id, memo: memo ?? `Reversal of ${o.memo ?? sourceType}`,
          lines: { create: lines.map((l) => ({ vendorId, accountCode: l.accountCode, partyId: l.partyId ?? null, debitPaise: l.debitPaise, creditPaise: l.creditPaise })) },
        },
      });
      reversed = true;
    }
    return { reversed };
  }

  async requireDoc<T>(v: T | null | undefined, what = 'Document'): Promise<T> {
    if (!v) throw new NotFoundException(`${what} not found`);
    return v;
  }
}
