import { OrderStatus } from '../../src/plan-billing/core/order-state';
import {
  AssignArgs, BillingTx, DueSub, DuplicateOrderError, EventRow, InvoiceRow, NewOrder, OrderPatch, OrderRow, PlanBillingRepository, PlanRow, PriceRow, SubRow, VendorRow,
} from '../../src/plan-billing/plan-billing.repository';
import { Actor } from '../../src/plans/admin/audit.service';
import { WalletTx } from '../../src/v3-wallet/wallet.store';
import { DiscountRuleRow, TaxRateRow } from '../../src/plans/pricing/price-quote';

export interface MemSub { id: string; vendorId: string; planId: string; status: string; startsAt: Date; endsAt: Date | null; graceEndsAt: Date | null; termMonths: number | null; amountPaise: number | null; current: boolean; source: string }

/** In-memory twin of the Prisma plan billing repository: per-vendor serialised transactions that roll back on a throw, gap-free counters, unique keys, a subscription table with the same close-the-old-open-the-new rule. */
export class MemoryBillingRepo extends PlanBillingRepository {
  plans = new Map<string, PlanRow>(); prices: Array<{ planId: string; termMonths: number; row: PriceRow; status: 'PROPOSED' | 'APPROVED'; effectiveFrom: Date }> = [];
  taxes: TaxRateRow[] = []; discounts: DiscountRuleRow[] = []; vendors = new Map<string, VendorRow>();
  subs: MemSub[] = []; orders = new Map<string, OrderRow>(); invoices: InvoiceRow[] = []; counters = new Map<string, number>(); events = new Map<string, EventRow>();
  reminders: Array<{ subscriptionId: string; daysBefore: number; endsAt: Date; kind: string }> = [];
  audits: Array<{ actor: Actor; action: string; entityId: string | null; before: unknown; after: unknown }> = [];
  clock: () => Date = () => new Date();
  failAssignOnce = false;
  /** Batch 4: the wallet's side of a transaction, and how to roll the wallet back with it (set by the wallet world; absent = no wallet) */
  walletTxFor?: (vendorId: string) => Promise<WalletTx>;
  walletSnapshot?: () => () => void;
  private n = 0; private chain: Promise<unknown> = Promise.resolve();
  private id(p: string): string { return `${p}-${++this.n}`; }

  async getPlanByKey(key: string) { const p = [...this.plans.values()].find((x) => x.key === key); return p ? { ...p } : null; }
  async getPlanById(id: string) { const p = this.plans.get(id); return p ? { ...p } : null; }
  async activePrice(planId: string, term: number, now: Date) {
    const c = this.prices.filter((p) => p.planId === planId && p.termMonths === term && p.status === 'APPROVED' && p.effectiveFrom <= now).sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());
    return c[0] ? { ...c[0].row } : null;
  }
  async taxRates() { return this.taxes.map((t) => ({ ...t })); }
  async discountRules() { return this.discounts.map((d) => ({ ...d })); }
  async vendor(id: string) { const v = this.vendors.get(id); return v ? { ...v } : null; }
  async currentSub(vendorId: string): Promise<SubRow | null> {
    const s = this.subs.find((x) => x.vendorId === vendorId && x.current); if (!s) return null; const p = this.plans.get(s.planId)!;
    return { id: s.id, vendorId, planId: s.planId, planKey: p.key, track: p.track, level: p.level, status: s.status, startsAt: s.startsAt, endsAt: s.endsAt, graceEndsAt: s.graceEndsAt, termMonths: s.termMonths, amountPaise: s.amountPaise };
  }

  private cp(o: OrderRow | undefined): OrderRow | null { return o ? { ...o, quote: { ...o.quote } } : null; }
  async getOrder(id: string) { return this.cp(this.orders.get(id)); }
  async findOrderByProviderId(pid: string) { return this.cp([...this.orders.values()].find((o) => o.providerOrderId === pid)); }
  async findOrderByIdempotency(v: string, k: string) { return this.cp([...this.orders.values()].find((o) => o.vendorId === v && o.idempotencyKey === k)); }
  async createOrder(d: NewOrder) {
    if ([...this.orders.values()].some((o) => o.vendorId === d.vendorId && o.idempotencyKey === d.idempotencyKey)) throw new DuplicateOrderError();
    const now = this.clock();
    const o: OrderRow = { ...d, id: this.id('ord'), status: 'CREATED', providerOrderId: null, paymentId: null, paidAmountPaise: null, paidAt: null, source: null, reason: null, subscriptionId: null, refundRecordedPaise: null, refundNote: null, refundRecordedBy: null, refundRecordedAt: null, createdAt: now, updatedAt: now };
    this.orders.set(o.id, o); return this.cp(o)!;
  }
  async updateOrderCas(id: string, expected: OrderStatus[], patch: OrderPatch) { const o = this.orders.get(id); if (!o || !expected.includes(o.status)) return false; if (patch.providerOrderId && [...this.orders.values()].some((x) => x.id !== id && x.providerOrderId === patch.providerOrderId)) throw new Error('duplicate provider order'); Object.assign(o, patch, { updatedAt: this.clock() }); return true; }
  async listOrdersForVendor(v: string, skip: number, take: number) { const all = [...this.orders.values()].filter((o) => o.vendorId === v).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); return { items: all.slice(skip, skip + take).map((o) => this.cp(o)!), total: all.length }; }
  async listOrders(q: { vendorId?: string; status?: OrderStatus; skip: number; take: number }) { const all = [...this.orders.values()].filter((o) => (!q.vendorId || o.vendorId === q.vendorId) && (!q.status || o.status === q.status)); return { items: all.slice(q.skip, q.skip + q.take).map((o) => this.cp(o)!), total: all.length }; }
  async expireStale(now: Date) { let n = 0; for (const o of this.orders.values()) if ((o.status === 'CREATED' || o.status === 'PENDING_PAYMENT') && o.expiresAt < now) { o.status = 'EXPIRED'; n++; } return n; }
  async listInvoicesForVendor(v: string, skip: number, take: number) { const all = this.invoices.filter((i) => i.vendorId === v); return { items: all.slice(skip, skip + take).map((i) => ({ ...i })), total: all.length }; }

  async insertEvent(d: { providerEventId: string; type: string; payloadRedacted: Record<string, unknown>; signatureValid: boolean; orderId: string | null }) {
    const ex = this.events.get(d.providerEventId); if (ex) return { created: false, row: { ...ex } };
    const row: EventRow = { id: this.id('evt'), provider: 'razorpay', providerEventId: d.providerEventId, type: d.type, payloadRedacted: d.payloadRedacted, signatureValid: d.signatureValid, orderId: d.orderId, processedAt: null, result: null, createdAt: this.clock() };
    this.events.set(d.providerEventId, row); return { created: true, row: { ...row } };
  }
  async finishEvent(id: string, patch: { processedAt: Date; result: string; orderId?: string | null }) { const e = this.events.get(id)!; e.processedAt = patch.processedAt; e.result = patch.result; if (patch.orderId !== undefined) e.orderId = patch.orderId; }
  async listEvents(q: { orderId?: string; skip: number; take: number }) { const all = [...this.events.values()].filter((e) => !q.orderId || e.orderId === q.orderId); return { items: all.slice(q.skip, q.skip + q.take).map((e) => ({ ...e })), total: all.length }; }

  async transaction<T>(vendorId: string, fn: (tx: BillingTx) => Promise<T>): Promise<T> {
    const run = this.chain.catch(() => undefined).then(() => this.atomic(fn, vendorId)); this.chain = run.catch(() => undefined); return run;
  }
  private async atomic<T>(fn: (tx: BillingTx) => Promise<T>, vendorId: string): Promise<T> {
    const restoreWallet = this.walletSnapshot?.();
    const snap = { orders: new Map([...this.orders].map(([k, v]) => [k, { ...v, quote: { ...v.quote } }])), subs: this.subs.map((s) => ({ ...s })), inv: this.invoices.map((i) => ({ ...i })), cnt: new Map(this.counters), aud: this.audits.length };
    try { return await fn(this.txObj(vendorId)); } catch (e) { restoreWallet?.(); this.orders = snap.orders; this.subs = snap.subs; this.invoices = snap.inv; this.counters = snap.cnt; this.audits.length = snap.aud; throw e; }
  }
  private txObj(vendorId: string): BillingTx {
    return {
      walletTx: this.walletTxFor ? () => this.walletTxFor!(vendorId) : undefined,
      getOrder: (id) => this.getOrder(id), createOrder: (d) => this.createOrder(d), updateOrderCas: (id, e, p) => this.updateOrderCas(id, e, p), currentSub: (v) => this.currentSub(v), vendor: (v) => this.vendor(v), getPlanById: (id) => this.getPlanById(id),
      assign: async (a: AssignArgs) => {
        if (this.failAssignOnce) { this.failAssignOnce = false; throw new Error('assign failed'); }
        const plan = (await this.getPlanByKey(a.planKey))!; const price = this.prices.filter((p) => p.planId === plan.id && p.termMonths === a.termMonths && p.status === 'APPROVED' && p.effectiveFrom <= a.now)[0];
        for (const s of this.subs) if (s.vendorId === a.vendorId && s.current) { s.current = false; s.status = 'CANCELLED'; }
        const sub: MemSub = { id: this.id('sub'), vendorId: a.vendorId, planId: plan.id, status: 'ACTIVE', startsAt: a.now, endsAt: a.endsAt, graceEndsAt: new Date(a.endsAt.getTime() + 7 * 86_400_000), termMonths: a.termMonths, amountPaise: price ? price.row.amountPaise : null, current: true, source: a.source };
        this.subs.push(sub); this.audits.push({ actor: a.actor, action: 'subscription.assign', entityId: sub.id, before: null, after: { planKey: a.planKey, endsAt: a.endsAt } }); return { id: sub.id, endsAt: sub.endsAt };
      },
      nextInvoiceNumber: async (fy) => { const n = (this.counters.get(fy) ?? 0) + 1; this.counters.set(fy, n); return n; },
      insertInvoice: async (d) => { if (this.invoices.some((i) => i.invoiceNumber === d.invoiceNumber || i.orderId === d.orderId)) throw new Error('duplicate invoice'); const row = { ...d, id: this.id('inv') }; this.invoices.push(row); return { ...row }; },
      audit: async (actor, action, entityId, before, after) => { this.audits.push({ actor, action, entityId, before, after }); },
    };
  }

  async dueSubscriptions(now: Date, maxDays: number): Promise<DueSub[]> {
    return this.subs.filter((s) => s.current && s.status === 'ACTIVE' && s.endsAt && s.endsAt > now && s.endsAt <= new Date(now.getTime() + maxDays * 86_400_000) && this.plans.get(s.planId)!.level === 'PRO')
      .map((s) => ({ id: s.id, vendorId: s.vendorId, endsAt: s.endsAt as Date, status: s.status, email: this.vendors.get(s.vendorId)!.email, businessName: this.vendors.get(s.vendorId)!.businessName }));
  }
  async loggedReminders(ids: string[]) { return new Set(this.reminders.filter((r) => ids.includes(r.subscriptionId)).map((r) => `${r.subscriptionId}|${r.daysBefore}|${r.endsAt.toISOString()}`)); }
  async insertReminder(d: { subscriptionId: string; daysBefore: number; endsAt: Date; kind: 'SENT' | 'SKIPPED' }) {
    if (this.reminders.some((r) => r.subscriptionId === d.subscriptionId && r.daysBefore === d.daysBefore && r.endsAt.getTime() === d.endsAt.getTime())) return false; this.reminders.push({ ...d }); return true;
  }
}
