import { Actor } from '../../src/plans/admin/audit.service';
import { MethodKind, MethodStatus, formatInvoiceNumber } from '../../src/requests-orders/core/commerce-core';
import { Channel } from '../../src/requests-orders/core/messaging-core';
import { RequestKind, RequestStatus } from '../../src/requests-orders/core/requests-core';
import {
  BlockRow, EventRow, InvoiceRow, MethodRow, MethodSecrets, NewEvent, NewOrder, NewRequest, OfferRow, OrderItemRow, OrderRow, OrderStatus, OfferUsedUp, OutboxRow, ReportRow, RequestFilter, RequestRow,
  RequestsStore, SealedBox, StockUnavailable,
} from '../../src/requests-orders/requests.store';

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** In-memory twin of the Prisma requests store. JavaScript runs one statement at a time, so each method here is atomic like the one database transaction behind it. */
export class MemoryRequestsStore extends RequestsStore {
  requests = new Map<string, RequestRow>(); eventsByRequest = new Map<string, EventRow[]>(); consents = new Map<string, { ipHash: string | null; textVersion: number; textHash: string }>();
  tracking = new Map<string, { requestId: string; expiresAt: Date }>(); methods = new Map<string, MethodRow & { secrets: MethodSecrets }>(); orders = new Map<string, OrderRow>(); items = new Map<string, OrderItemRow[]>();
  paymentEvents = new Map<string, { result: string; signatureValid: boolean; payload: unknown }>(); invoices = new Map<string, InvoiceRow>(); counters = new Map<string, number>(); offers = new Map<string, OfferRow>();
  stock = new Map<string, { onHand: number; reserved: number }>(); reservations: Array<{ orderId: string; vendorId: string; productRef: string; qty: number; expiresAt: Date; released: boolean; committed: boolean }> = [];
  outbox: OutboxRow[] = []; suppressions = new Set<string>(); reports = new Map<string, ReportRow>(); blocks = new Map<string, BlockRow>(); audits: Array<{ action: string; entityId: string | null; after: unknown }> = [];
  clock: () => Date = () => new Date(); private n = 0;
  private id = (p: string): string => `${p}-${++this.n}`;
  private next(vendorId: string, kind: 'ORDER' | 'INVOICE'): number { const k = `${vendorId}|${kind}`; const v = (this.counters.get(k) ?? 0) + 1; this.counters.set(k, v); return v; }

  async findByIdempotency(vendorId: string, key: string) { const r = [...this.requests.values()].find((x) => x.vendorId === vendorId && x.idempotencyKey === key); return r ? { ...r } : null; }
  private insertRequest(r: NewRequest): RequestRow {
    const now = this.clock(); const row: RequestRow = {
      id: this.id('req'), vendorId: r.vendorId, siteHost: r.siteHost, kind: r.kind, status: r.status, customerName: r.customerName, customerPhoneE164: r.customerPhoneE164, customerEmail: r.customerEmail, payload: r.payload,
      sourceKind: r.sourceKind, directoryRefHash: r.directoryRefHash, utmSource: r.utmSource, utmMedium: r.utmMedium, utmCampaign: r.utmCampaign, idempotencyKey: r.idempotencyKey, spamScore: r.spamScore,
      firstSeenAt: null, firstResponseAt: null, expiresAt: r.expiresAt, convertedCustomerId: null, convertedBookingId: null, createdAt: now, updatedAt: now,
    };
    this.requests.set(row.id, row);
    this.consents.set(row.id, { ipHash: r.consent.ipHash, textVersion: r.consent.textVersion, textHash: r.consent.textHash });
    if (r.trackingTokenHash && r.trackingExpiresAt) this.tracking.set(r.trackingTokenHash, { requestId: row.id, expiresAt: r.trackingExpiresAt });
    this.eventsByRequest.set(row.id, r.events.map((e) => ({ id: this.id('ev'), requestId: row.id, type: e.type, actorType: e.actorType, channel: e.channel ?? null, deliveryResult: e.deliveryResult ?? null, at: now, meta: e.meta ?? {} })));
    return row;
  }
  async createRequest(r: NewRequest) {
    if ([...this.requests.values()].some((x) => x.vendorId === r.vendorId && x.idempotencyKey === r.idempotencyKey)) throw Object.assign(new Error('unique'), { code: 'P2002' });
    return { ...this.insertRequest(r) };
  }
  async getRequest(id: string, vendorId?: string) { const r = this.requests.get(id); return r && (!vendorId || r.vendorId === vendorId) ? { ...r } : null; }
  async listRequests(vendorId: string | null, f: RequestFilter) {
    const all = [...this.requests.values()].filter((r) => (!vendorId || r.vendorId === vendorId) && (!f.status || r.status === f.status) && (!f.kind || r.kind === f.kind) && (!f.from || r.createdAt >= f.from) && (!f.to || r.createdAt <= f.to)
      && (!f.q || r.customerName.toLowerCase().includes(f.q.toLowerCase()))).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1));
    return { items: all.slice(f.skip, f.skip + f.take).map((r) => ({ ...r })), total: all.length };
  }
  async transition(id: string, from: RequestStatus, to: RequestStatus, patch: { firstSeenAt?: Date; firstResponseAt?: Date }, event: NewEvent) {
    const r = this.requests.get(id); if (!r || r.status !== from) return null;
    r.status = to; if (patch.firstSeenAt && !r.firstSeenAt) r.firstSeenAt = patch.firstSeenAt; if (patch.firstResponseAt && !r.firstResponseAt) r.firstResponseAt = patch.firstResponseAt; r.updatedAt = this.clock();
    await this.addEvent(id, event, this.clock()); return { ...r };
  }
  async addEvent(requestId: string, e: NewEvent, at: Date) { const l = this.eventsByRequest.get(requestId) ?? []; l.push({ id: this.id('ev'), requestId, type: e.type, actorType: e.actorType, channel: e.channel ?? null, deliveryResult: e.deliveryResult ?? null, at, meta: e.meta ?? {} }); this.eventsByRequest.set(requestId, l); }
  async events(requestId: string) { return [...(this.eventsByRequest.get(requestId) ?? [])]; }
  async setLinks(id: string, vendorId: string, links: { customerId?: string; bookingId?: string }) { const r = this.requests.get(id); if (!r || r.vendorId !== vendorId) return null; if (links.customerId) r.convertedCustomerId = links.customerId; if (links.bookingId) r.convertedBookingId = links.bookingId; return { ...r }; }
  async trackingByHash(hash: string) { const t = this.tracking.get(hash); const r = t && this.requests.get(t.requestId); return t && r ? { request: { ...r }, expiresAt: t.expiresAt } : null; }
  async countRecentByPhone(vendorId: string, phone: string, since: Date) { return [...this.requests.values()].filter((r) => r.vendorId === vendorId && r.customerPhoneE164 === phone && r.createdAt >= since).length; }
  async countRecentByIp(ipHash: string, since: Date) { return [...this.requests.values()].filter((r) => this.consents.get(r.id)?.ipHash === ipHash && r.createdAt >= since).length; }
  async findRecentDuplicate(vendorId: string, phone: string, kind: RequestKind, payload: Record<string, unknown>, since: Date) {
    const r = [...this.requests.values()].find((x) => x.vendorId === vendorId && x.customerPhoneE164 === phone && x.kind === kind && x.createdAt >= since && sameJson(x.payload, payload)); return r ? { ...r } : null;
  }
  async expirable(now: Date, limit: number) { return [...this.requests.values()].filter((r) => ['RECEIVED', 'DELIVERED', 'SEEN'].includes(r.status) && r.expiresAt <= now).slice(0, limit).map((r) => ({ ...r })); }
  async nudgeCandidates(before: Date, limit: number) { return [...this.requests.values()].filter((r) => ['RECEIVED', 'DELIVERED', 'SEEN'].includes(r.status) && !r.firstResponseAt && r.createdAt <= before).slice(0, limit).map((r) => ({ ...r })); }

  private view(m: MethodRow & { secrets: MethodSecrets }): MethodRow { const { secrets: _s, ...v } = m; return { ...v, hasSecret: !!m.secrets.config.cipher, hasWebhookSecret: !!m.secrets.webhook.cipher }; }
  async createMethod(d: { vendorId: string; kind: MethodKind; label: string; last4: string | null; config: SealedBox; webhook: SealedBox; upiId?: string | null; payeeName?: string | null; showToCustomers?: boolean }) {
    const now = this.clock(); const row = { id: this.id('pm'), vendorId: d.vendorId, kind: d.kind, label: d.label, last4: d.last4, upiId: d.upiId ?? null, payeeName: d.payeeName ?? null, isDefault: false, showToCustomers: d.showToCustomers ?? false, hasSecret: false, hasWebhookSecret: false, status: 'UNVERIFIED' as MethodStatus, verifiedAt: null, createdAt: now, updatedAt: now, secrets: { config: d.config, webhook: d.webhook } };
    this.methods.set(row.id, row); return this.view(row);
  }
  async listMethods(vendorId: string) { return [...this.methods.values()].filter((m) => m.vendorId === vendorId).map((m) => this.view(m)); }
  async getMethod(id: string, vendorId?: string) { const m = this.methods.get(id); return m && (!vendorId || m.vendorId === vendorId) ? this.view(m) : null; }
  async methodSecrets(id: string, vendorId: string) { const m = this.methods.get(id); return m && m.vendorId === vendorId ? { config: { ...m.secrets.config }, webhook: { ...m.secrets.webhook } } : null; }
  async updateMethod(id: string, vendorId: string, p: { label?: string; status?: MethodStatus; verifiedAt?: Date | null; last4?: string | null; config?: SealedBox; webhook?: SealedBox; upiId?: string | null; payeeName?: string | null; showToCustomers?: boolean; isDefault?: boolean }) {
    const m = this.methods.get(id); if (!m || m.vendorId !== vendorId) return null;
    if (p.label !== undefined) m.label = p.label; if (p.status !== undefined) m.status = p.status; if (p.verifiedAt !== undefined) m.verifiedAt = p.verifiedAt; if (p.last4 !== undefined) m.last4 = p.last4;
    if (p.upiId !== undefined) m.upiId = p.upiId; if (p.payeeName !== undefined) m.payeeName = p.payeeName; if (p.showToCustomers !== undefined) m.showToCustomers = p.showToCustomers; if (p.isDefault !== undefined) m.isDefault = p.isDefault;
    if (p.config) m.secrets.config = p.config; if (p.webhook) m.secrets.webhook = p.webhook; m.updatedAt = this.clock(); return this.view(m);
  }

  async setDefaultMethod(id: string, vendorId: string) {
    const m = this.methods.get(id); if (!m || m.vendorId !== vendorId) return null;
    for (const o of this.methods.values()) if (o.vendorId === vendorId) o.isDefault = o.id === id;
    return this.view(m);
  }

  async placeOrder(o: NewOrder) {
    // check everything first, then write: the real transaction rolls back, here nothing has been written yet
    for (const it of o.items) { const s = this.stock.get(`${o.request.vendorId}|${it.productRef}`); if (s && s.onHand - s.reserved < it.qty) throw new StockUnavailable(it.productRef); }
    if (o.offerId) { const of = this.offers.get(o.offerId)!; if (of.usageLimit !== null && of.usedCount >= of.usageLimit) throw new OfferUsedUp(); }
    if ([...this.requests.values()].some((x) => x.vendorId === o.request.vendorId && x.idempotencyKey === o.request.idempotencyKey)) throw Object.assign(new Error('unique'), { code: 'P2002' });
    const request = this.insertRequest(o.request); const orderNo = this.next(o.request.vendorId, 'ORDER'); const now = this.clock();
    const order: OrderRow = { id: this.id('ord'), vendorId: o.request.vendorId, requestId: request.id, orderNo, status: o.paymentMode === 'ONLINE' ? 'AWAITING_PAYMENT' : 'PLACED', paymentMode: o.paymentMode, methodId: o.methodId, amountPaise: o.amountPaise, currency: o.currency, reviewFlag: false, shipping: o.shipping, tracking: {}, refundedPaise: 0, paidAt: null, createdAt: now, updatedAt: now };
    this.orders.set(order.id, order);
    const items = o.items.map((it): OrderItemRow => ({ id: this.id('oi'), orderId: order.id, productRef: it.productRef, name: it.name, qty: it.qty, unitPaise: it.unitPaise, tax: it.tax })); this.items.set(order.id, items);
    for (const it of o.items) { const s = this.stock.get(`${request.vendorId}|${it.productRef}`); if (s) { s.reserved += it.qty; this.reservations.push({ orderId: order.id, vendorId: request.vendorId, productRef: it.productRef, qty: it.qty, expiresAt: o.reserveUntil, released: false, committed: false }); } }
    if (o.offerId) this.offers.get(o.offerId)!.usedCount += 1;
    return { order: { ...order }, request: { ...request }, items: items.map((i) => ({ ...i })) };
  }
  async getOrder(id: string, vendorId?: string) { const o = this.orders.get(id); return o && (!vendorId || o.vendorId === vendorId) ? { order: { ...o }, items: (this.items.get(id) ?? []).map((i) => ({ ...i })) } : null; }
  async orderByRequest(requestId: string) { const o = [...this.orders.values()].find((x) => x.requestId === requestId); return o ? { order: { ...o }, items: (this.items.get(o.id) ?? []).map((i) => ({ ...i })) } : null; }
  async listOrders(vendorId: string, f: { status?: OrderStatus; skip: number; take: number }) { const all = [...this.orders.values()].filter((o) => o.vendorId === vendorId && (!f.status || o.status === f.status)).sort((a, b) => b.orderNo - a.orderNo); return { items: all.slice(f.skip, f.skip + f.take).map((o) => ({ ...o })), total: all.length }; }
  async moveOrder(id: string, vendorId: string, from: OrderStatus, to: OrderStatus, patch: { tracking?: Record<string, unknown> }) { const o = this.orders.get(id); if (!o || o.vendorId !== vendorId || o.status !== from) return null; o.status = to; if (patch.tracking) o.tracking = { ...o.tracking, ...patch.tracking }; o.updatedAt = this.clock(); return { ...o }; }
  async markPaid(orderId: string, vendorId: string, now: Date) {
    const o = this.orders.get(orderId)!;
    if (o.vendorId !== vendorId) throw new Error('not this vendor');
    if (o.status !== 'PLACED' && o.status !== 'AWAITING_PAYMENT') return { order: { ...o }, alreadyPaid: true, invoice: null };
    o.status = 'PAID'; o.paidAt = now; o.updatedAt = now;
    for (const r of this.reservations.filter((x) => x.orderId === orderId && !x.released && !x.committed)) { const s = this.stock.get(`${vendorId}|${r.productRef}`); if (s) { s.onHand -= r.qty; s.reserved -= r.qty; } r.committed = true; }
    return { order: { ...o }, alreadyPaid: false, invoice: null };   // the old 5.14 invoice is retired (Block 4b W5): one order payment, one document, the 5.17d one
  }
  async flagReview(orderId: string, vendorId: string) { const o = this.orders.get(orderId); if (o && o.vendorId === vendorId) o.reviewFlag = true; }
  async recordRefund(orderId: string, vendorId: string, amountPaise: number) {
    const o = this.orders.get(orderId); if (!o || o.vendorId !== vendorId) return null; o.refundedPaise += amountPaise; if (o.refundedPaise >= o.amountPaise) o.status = 'REFUNDED_RECORDED'; return { ...o };
  }
  async recordPaymentEvent(e: { vendorId: string; methodId: string; providerEventId: string; signatureValid: boolean; payload: Record<string, unknown>; result: string }) {
    const k = `${e.vendorId}|${e.providerEventId}`; if (this.paymentEvents.has(k)) return false; this.paymentEvents.set(k, { result: e.result, signatureValid: e.signatureValid, payload: e.payload }); return true;
  }

  async createInvoice(d: { vendorId: string; orderId: string | null; requestId: string | null; snapshot: Record<string, unknown>; prefix: string; now: Date }) {
    const seq = this.next(d.vendorId, 'INVOICE'); const inv: InvoiceRow = { id: this.id('inv'), vendorId: d.vendorId, orderId: d.orderId, requestId: d.requestId, seq, invoiceNumber: formatInvoiceNumber(d.prefix, seq), issuedAt: d.now, snapshot: d.snapshot, status: 'ISSUED', voidedAt: null, voidReason: null };
    this.invoices.set(inv.id, inv); return { ...inv };
  }
  async listInvoices(vendorId: string, skip: number, take: number) { const all = [...this.invoices.values()].filter((i) => i.vendorId === vendorId).sort((a, b) => b.seq - a.seq); return { items: all.slice(skip, skip + take).map((i) => ({ ...i })), total: all.length }; }
  async getInvoice(id: string, vendorId: string) { const i = this.invoices.get(id); return i && i.vendorId === vendorId ? { ...i } : null; }
  async voidInvoice(id: string, vendorId: string, reason: string, now: Date) { const i = this.invoices.get(id); if (!i || i.vendorId !== vendorId) return null; if (i.status === 'ISSUED') { i.status = 'VOID'; i.voidedAt = now; i.voidReason = reason; } return { ...i }; }
  async createOffer(d: Omit<OfferRow, 'id' | 'usedCount' | 'createdAt' | 'updatedAt'>) {
    if (d.code && [...this.offers.values()].some((o) => o.vendorId === d.vendorId && o.code === d.code)) throw Object.assign(new Error('unique'), { code: 'P2002' });
    const now = this.clock(); const row: OfferRow = { ...d, id: this.id('off'), usedCount: 0, createdAt: now, updatedAt: now }; this.offers.set(row.id, row); return { ...row };
  }
  async listOffers(vendorId: string) { return [...this.offers.values()].filter((o) => o.vendorId === vendorId).map((o) => ({ ...o })); }
  async getOffer(id: string, vendorId: string) { const o = this.offers.get(id); return o && o.vendorId === vendorId ? { ...o } : null; }
  async offerByCode(vendorId: string, code: string) { const o = [...this.offers.values()].find((x) => x.vendorId === vendorId && x.code === code); return o ? { ...o } : null; }
  async updateOffer(id: string, vendorId: string, p: Partial<Pick<OfferRow, 'title' | 'percentOff' | 'flatPaise' | 'minOrderPaise' | 'startsAt' | 'endsAt' | 'usageLimit' | 'status'>>) { const o = this.offers.get(id); if (!o || o.vendorId !== vendorId) return null; Object.assign(o, p, { updatedAt: this.clock() }); return { ...o }; }
  async setStock(vendorId: string, productRef: string, onHand: number) { const k = `${vendorId}|${productRef}`; const s = this.stock.get(k) ?? { onHand: 0, reserved: 0 }; s.onHand = onHand; this.stock.set(k, s); }
  async getStock(vendorId: string, productRef: string) { const s = this.stock.get(`${vendorId}|${productRef}`); return s ? { ...s } : null; }
  async releaseExpiredReservations(now: Date) {
    let n = 0;
    for (const r of this.reservations) { if (!r.released && !r.committed && r.expiresAt <= now) { const s = this.stock.get(`${r.vendorId}|${r.productRef}`); if (s) s.reserved -= r.qty; r.released = true; n++; } }
    return n;
  }

  async addMessage(m: Omit<OutboxRow, 'id' | 'createdAt'>, at: Date) { const row: OutboxRow = { ...m, id: this.id('msg'), createdAt: at }; this.outbox.push(row); return row; }
  async listOutbox(f: { vendorId?: string; requestId?: string; skip: number; take: number }) { const all = this.outbox.filter((m) => (!f.vendorId || m.vendorId === f.vendorId) && (!f.requestId || m.relatedRequestId === f.requestId)); return { items: all.slice(f.skip, f.skip + f.take), total: all.length }; }
  async suppressed(hash: string, channel: Channel) { return this.suppressions.has(`${hash}|${channel}`); }
  async addSuppression(hash: string, channel: Channel) { const k = `${hash}|${channel}`; if (this.suppressions.has(k)) return false; this.suppressions.add(k); return true; }

  async createReport(r: Omit<ReportRow, 'id' | 'status' | 'handledBy' | 'handledAt' | 'createdAt'>) { const row: ReportRow = { ...r, id: this.id('rep'), status: 'OPEN', handledBy: null, handledAt: null, createdAt: this.clock() }; this.reports.set(row.id, row); return { ...row }; }
  async listReports(f: { status?: ReportRow['status']; skip: number; take: number }) { const all = [...this.reports.values()].filter((r) => !f.status || r.status === f.status); return { items: all.slice(f.skip, f.skip + f.take).map((r) => ({ ...r })), total: all.length }; }
  async handleReport(id: string, status: ReportRow['status'], by: string | null, now: Date) { const r = this.reports.get(id); if (!r) return null; r.status = status; r.handledBy = by; r.handledAt = now; return { ...r }; }
  async addBlock(b: Omit<BlockRow, 'id' | 'at'>, at: Date) { const k = `${b.kind}|${b.hash}`; const ex = [...this.blocks.values()].find((x) => `${x.kind}|${x.hash}` === k); if (ex) return ex; const row: BlockRow = { ...b, id: this.id('blk'), at }; this.blocks.set(row.id, row); return row; }
  async listBlocks(skip: number, take: number) { const all = [...this.blocks.values()]; return { items: all.slice(skip, skip + take), total: all.length }; }
  async removeBlock(id: string) { return this.blocks.delete(id); }
  async isBlocked(kind: BlockRow['kind'], hash: string) { return [...this.blocks.values()].some((b) => b.kind === kind && b.hash === hash); }
  async recordAudit(_a: Actor, action: string, _t: string, entityId: string | null, _b: unknown, after: unknown) { this.audits.push({ action, entityId, after }); }
}
