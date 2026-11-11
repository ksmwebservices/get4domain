import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DocKind, DocLine, formatDocNumber } from './core/doc-core';
import { DocCodeTaken, DocTax, DocumentRow, DocumentsStore, NewDocument, OutboxEntry, SendStatus, TaxProfileRow } from './documents.store';

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const toDoc = (d: Prisma.V3VendorDocumentGetPayload<object>): DocumentRow => ({
  id: d.id, vendorId: d.vendorId, kind: d.kind as DocKind, number: d.number, seq: d.seq, periodKey: d.periodKey, paymentId: d.paymentId, customerSnapshot: obj(d.customerSnapshot),
  items: (Array.isArray(d.itemsJson) ? d.itemsJson : []) as unknown as DocLine[], tax: obj(d.taxJson) as unknown as DocTax, totalPaise: d.totalPaise, pdfRef: d.pdfRef, publicCode: d.publicCode,
  whatsappStatus: d.whatsappStatus as SendStatus, emailStatus: d.emailStatus as SendStatus, resendCount: d.resendCount, flags: obj(d.flagsJson), createdAt: d.createdAt,
});
const toProfile = (p: Prisma.V3VendorTaxProfileGetPayload<object>): TaxProfileRow => ({ vendorId: p.vendorId, gstRegistered: p.gstRegistered, gstin: p.gstin, stateCode: p.stateCode, legalName: p.legalName, address: p.address, compositionScheme: p.compositionScheme, invoicePrefix: p.invoicePrefix });

@Injectable()
export class PrismaDocumentsStore extends DocumentsStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  async getProfile(vendorId: string): Promise<TaxProfileRow | null> { const p = await this.prisma.v3VendorTaxProfile.findUnique({ where: { vendorId } }); return p ? toProfile(p) : null; }
  async saveProfile(p: TaxProfileRow): Promise<TaxProfileRow> {
    const data = { gstRegistered: p.gstRegistered, gstin: p.gstin, stateCode: p.stateCode, legalName: p.legalName, address: p.address, compositionScheme: p.compositionScheme, invoicePrefix: p.invoicePrefix };
    return toProfile(await this.prisma.v3VendorTaxProfile.upsert({ where: { vendorId: p.vendorId }, create: { vendorId: p.vendorId, ...data }, update: data }));
  }

  /** One transaction: the unique payment id is checked, the series row is bumped (the update takes a row lock, so two writers queue), the document is written. A failure rolls the number back. */
  async createDocument(d: NewDocument): Promise<{ doc: DocumentRow; created: boolean }> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const existing = await tx.v3VendorDocument.findUnique({ where: { paymentId: d.paymentId } });
          if (existing) return { doc: toDoc(existing), created: false };
          const series = await tx.v3InvoiceSeries.upsert({ where: { vendorId_periodKey: { vendorId: d.vendorId, periodKey: d.periodKey } }, create: { vendorId: d.vendorId, periodKey: d.periodKey, prefix: d.prefix, nextNumber: 2 }, update: { nextNumber: { increment: 1 } } });
          const seq = series.nextNumber - 1;
          const row = await tx.v3VendorDocument.create({ data: { vendorId: d.vendorId, kind: d.kind, number: formatDocNumber(series.prefix, d.periodKey, seq), seq, periodKey: d.periodKey, paymentId: d.paymentId, customerSnapshot: d.customerSnapshot as Prisma.InputJsonValue, itemsJson: d.items as unknown as Prisma.InputJsonValue, taxJson: d.tax as unknown as Prisma.InputJsonValue, totalPaise: d.totalPaise, publicCode: d.publicCode, flagsJson: d.flags as Prisma.InputJsonValue } });
          return { doc: toDoc(row), created: true };
        }, { maxWait: 15_000 });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          const target = JSON.stringify(e.meta?.target ?? '');
          if (/publicCode/.test(target)) throw new DocCodeTaken();
          if (attempt === 0) continue;   // two first documents of a year raced on the series row: the loser retries once and finds it
        }
        throw e;
      }
    }
    throw new Error('document number could not be allocated');
  }

  async byPayment(paymentId: string, vendorId: string): Promise<DocumentRow | null> { const d = await this.prisma.v3VendorDocument.findFirst({ where: { paymentId, vendorId } }); return d ? toDoc(d) : null; }
  async byId(id: string, vendorId: string): Promise<DocumentRow | null> { const d = await this.prisma.v3VendorDocument.findFirst({ where: { id, vendorId } }); return d ? toDoc(d) : null; }
  async byCode(code: string): Promise<DocumentRow | null> { const d = await this.prisma.v3VendorDocument.findUnique({ where: { publicCode: code } }); return d ? toDoc(d) : null; }
  async list(vendorId: string, skip: number, take: number): Promise<{ items: DocumentRow[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([this.prisma.v3VendorDocument.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' }, skip, take }), this.prisma.v3VendorDocument.count({ where: { vendorId } })]);
    return { items: items.map(toDoc), total };
  }
  async setSend(id: string, vendorId: string, p: { whatsappStatus?: SendStatus; emailStatus?: SendStatus; pdfRef?: string; bumpResend?: boolean }): Promise<DocumentRow | null> {
    const res = await this.prisma.v3VendorDocument.updateMany({ where: { id, vendorId }, data: { ...(p.whatsappStatus ? { whatsappStatus: p.whatsappStatus } : {}), ...(p.emailStatus ? { emailStatus: p.emailStatus } : {}), ...(p.pdfRef ? { pdfRef: p.pdfRef } : {}), ...(p.bumpResend ? { resendCount: { increment: 1 } } : {}) } });
    return res.count === 1 ? this.byId(id, vendorId) : null;
  }
  async addOutbox(e: OutboxEntry): Promise<{ id: string; created: boolean }> {
    try { const r = await this.prisma.v3Outbox.create({ data: { vendorId: e.vendorId, channel: e.channel, templateKey: e.templateKey, toHash: e.toHash, toMasked: e.toMasked, payloadJson: e.payload as Prisma.InputJsonValue, idempotencyKey: e.idempotencyKey } }); return { id: r.id, created: true }; }
    catch (err) { if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') { const r = await this.prisma.v3Outbox.findUniqueOrThrow({ where: { idempotencyKey: e.idempotencyKey } }); return { id: r.id, created: false }; } throw err; }
  }
  async setOutboxStatus(id: string, status: string): Promise<void> { await this.prisma.v3Outbox.update({ where: { id }, data: { status, attempts: { increment: 1 } } }); }
}
