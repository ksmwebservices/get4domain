import { formatDocNumber } from '../../src/v3-payments/core/doc-core';
import { DocCodeTaken, DocumentRow, DocumentsStore, NewDocument, OutboxEntry, SendStatus, TaxProfileRow } from '../../src/v3-payments/documents.store';

/** The in-memory twin of DocumentsStore. Same rules as the Prisma store: one document per payment, a gap-free series per vendor and year, an idempotent outbox. `failNext` makes the next write fail AFTER the number was taken, like a rolled-back transaction. */
export class MemoryDocumentsStore extends DocumentsStore {
  profiles = new Map<string, TaxProfileRow>(); docs = new Map<string, DocumentRow>(); series = new Map<string, { prefix: string; next: number }>();
  outbox = new Map<string, { id: string; entry: OutboxEntry; status: string; attempts: number }>(); failNext = false; private n = 0;

  async getProfile(vendorId: string) { const p = this.profiles.get(vendorId); return p ? { ...p } : null; }
  async saveProfile(p: TaxProfileRow) { this.profiles.set(p.vendorId, { ...p }); return { ...p }; }
  async createDocument(d: NewDocument): Promise<{ doc: DocumentRow; created: boolean }> {
    const existing = [...this.docs.values()].find((x) => x.paymentId === d.paymentId); if (existing) return { doc: { ...existing }, created: false };
    if ([...this.docs.values()].some((x) => x.publicCode === d.publicCode)) throw new DocCodeTaken();
    const key = `${d.vendorId}|${d.periodKey}`; const s = this.series.get(key) ?? { prefix: d.prefix, next: 1 };
    const seq = s.next;
    if (this.failNext) { this.failNext = false; throw new Error('write failed after the number was taken; the transaction rolls back'); }
    s.next = seq + 1; this.series.set(key, s);
    const doc: DocumentRow = { id: `doc${++this.n}`, vendorId: d.vendorId, kind: d.kind, number: formatDocNumber(s.prefix, d.periodKey, seq), seq, periodKey: d.periodKey, paymentId: d.paymentId, customerSnapshot: d.customerSnapshot, items: d.items, tax: d.tax, totalPaise: d.totalPaise, pdfRef: null, publicCode: d.publicCode, whatsappStatus: 'NONE', emailStatus: 'NONE', resendCount: 0, flags: d.flags, createdAt: new Date() };
    this.docs.set(doc.id, doc); return { doc: { ...doc }, created: true };
  }
  async byPayment(paymentId: string, vendorId: string) { const d = [...this.docs.values()].find((x) => x.paymentId === paymentId && x.vendorId === vendorId); return d ? { ...d } : null; }
  async byId(id: string, vendorId: string) { const d = this.docs.get(id); return d && d.vendorId === vendorId ? { ...d } : null; }
  async byCode(code: string) { const d = [...this.docs.values()].find((x) => x.publicCode === code); return d ? { ...d } : null; }
  async list(vendorId: string, skip: number, take: number) { const all = [...this.docs.values()].filter((d) => d.vendorId === vendorId).reverse(); return { items: all.slice(skip, skip + take).map((d) => ({ ...d })), total: all.length }; }
  async setSend(id: string, vendorId: string, p: { whatsappStatus?: SendStatus; emailStatus?: SendStatus; pdfRef?: string; bumpResend?: boolean }) {
    const d = this.docs.get(id); if (!d || d.vendorId !== vendorId) return null;
    if (p.whatsappStatus) d.whatsappStatus = p.whatsappStatus; if (p.emailStatus) d.emailStatus = p.emailStatus; if (p.pdfRef) d.pdfRef = p.pdfRef; if (p.bumpResend) d.resendCount += 1;
    return { ...d };
  }
  async addOutbox(e: OutboxEntry) { const ex = this.outbox.get(e.idempotencyKey); if (ex) return { id: ex.id, created: false }; const id = `ob${++this.n}`; this.outbox.set(e.idempotencyKey, { id, entry: e, status: 'PENDING', attempts: 0 }); return { id, created: true }; }
  async setOutboxStatus(id: string, status: string) { for (const o of this.outbox.values()) if (o.id === id) { o.status = status; o.attempts += 1; } }
}
