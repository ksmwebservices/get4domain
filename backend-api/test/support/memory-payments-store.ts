import { PayStatus } from '../../src/v3-payments/core/pay-core';
import { NewPayRequest, PayCodeTaken, PayRequestRow, PaymentRow, PaymentsStore } from '../../src/v3-payments/payments.store';

/** The in-memory twin of PaymentsStore for the unit tests. Same compare-and-set rules as the Prisma store. */
export class MemoryPaymentsStore extends PaymentsStore {
  rows = new Map<string, PayRequestRow>(); payments = new Map<string, PaymentRow>(); clock: () => Date = () => new Date(); private n = 0;

  async create(d: NewPayRequest): Promise<PayRequestRow> {
    if ([...this.rows.values()].some((r) => r.code === d.code)) throw new PayCodeTaken();
    const now = this.clock(); const row: PayRequestRow = { ...d, id: `pr${++this.n}`, status: 'AWAITING', customerSaidAt: null, customerUtr: null, createdAt: now, updatedAt: now };
    this.rows.set(row.id, row); return { ...row };
  }
  async byCode(code: string) { const r = [...this.rows.values()].find((x) => x.code === code); return r ? { ...r } : null; }
  async byId(id: string, vendorId: string) { const r = this.rows.get(id); return r && r.vendorId === vendorId ? { ...r } : null; }
  async list(vendorId: string, f: { status?: PayStatus; orderId?: string; skip: number; take: number }) {
    const all = [...this.rows.values()].filter((r) => r.vendorId === vendorId && (!f.status || r.status === f.status) && (!f.orderId || r.orderId === f.orderId)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { items: all.slice(f.skip, f.skip + f.take).map((r) => ({ ...r })), total: all.length };
  }
  async customerTaps(id: string, utr: string | null, now: Date) { const r = this.rows.get(id); if (!r || r.status !== 'AWAITING') return null; r.status = 'CUSTOMER_SAYS_PAID'; r.customerSaidAt = now; r.customerUtr = utr; return { ...r }; }
  async cancel(id: string, vendorId: string) { const r = this.rows.get(id); if (!r || r.vendorId !== vendorId || !['AWAITING', 'CUSTOMER_SAYS_PAID'].includes(r.status)) return null; r.status = 'CANCELLED'; return { ...r }; }
  async expire(id: string, now: Date) { const r = this.rows.get(id); if (!r || r.status !== 'AWAITING' || r.expiresAt > now) return false; r.status = 'EXPIRED'; return true; }
  async expirable(now: Date, limit: number) { return [...this.rows.values()].filter((r) => r.status === 'AWAITING' && r.expiresAt <= now).slice(0, limit).map((r) => ({ ...r })); }
  async confirmPaid(id: string, vendorId: string, p: { utr: string | null; idempotencyKey: string | null; now: Date }) {
    const r = this.rows.get(id); if (!r || r.vendorId !== vendorId || r.status === 'CANCELLED') return null;
    if (r.status === 'PAID') { const ex = this.payments.get(id); return ex ? { request: { ...r }, payment: { ...ex }, alreadyPaid: true } : null; }
    r.status = 'PAID';
    const pay: PaymentRow = { id: `pay${++this.n}`, paymentRequestId: id, vendorId, amountPaise: r.amountPaise, level: 1, provider: 'UPI_MANUAL', providerPaymentId: id, utr: p.utr ?? r.customerUtr, confirmedBy: 'VENDOR', confirmedAt: p.now, idempotencyKey: p.idempotencyKey };
    this.payments.set(id, pay); return { request: { ...r }, payment: { ...pay }, alreadyPaid: false };
  }
  async paymentOf(requestId: string, vendorId: string) { const p = this.payments.get(requestId); return p && p.vendorId === vendorId ? { ...p } : null; }
  async requestOfPayment(paymentId: string, vendorId: string) { const p = [...this.payments.values()].find((x) => x.id === paymentId && x.vendorId === vendorId); const r = p ? this.rows.get(p.paymentRequestId) : null; return r ? { ...r } : null; }
}
