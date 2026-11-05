import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { b3Error } from '../b3-settings/b3-errors';
import { B3SettingsService } from '../b3-settings/b3-settings.service';
import { Actor } from '../plans/admin/audit.service';
import { openSecret, sealSecret, SealedSecret } from '../ai-studio/secret-box';
import { LifecycleStore } from '../vendor-lifecycle/lifecycle.store';
import { MethodKind, MethodStatus, canMoveOrder } from './core/commerce-core';
import { RequestKind, RequestStatus, summarise, vendorMayMove } from './core/requests-core';
import { MessagingService } from './messaging.service';
import { AcceptanceGuard, OwnGatewayGate } from './requests-ports';
import { OfferRow, OrderStatus, RequestFilter, RequestsStore } from './requests.store';

const REQUIRED_TERMS = ['VENDOR_TERMS', 'ACCEPTABLE_USE', 'DATA_PROCESSING'] as const;
const nf = (code: 'REQUEST_NOT_FOUND' | 'PAYMENT_METHOD_INVALID' | 'ORDER_INVALID' | 'OFFER_INVALID', msg: string): NotFoundException => new NotFoundException(b3Error(code, msg));
const str = (v: unknown, min: number, max: number): string | null => { if (typeof v !== 'string') return null; const t = v.trim().replace(/\s+/g, ' '); return t.length >= min && t.length <= max ? t : null; };


/**
 * Seals a credential with the platform key. When PLATFORM_SETTINGS_KEY is not configured the helper throws a plain Error, which used to surface as a 500; the answer is now a clear 503
 * with a stable code, and NOTHING is stored (a secret is never kept unencrypted: there is no fallback path that writes plain text).
 */
export function sealOrFail(plain: string): SealedSecret {
  try { return sealSecret(plain); } catch (e) {
    if (e instanceof Error && /PLATFORM_SETTINGS_KEY/.test(e.message)) throw new ServiceUnavailableException(b3Error('SECRET_STORE_UNAVAILABLE', 'Payment credentials cannot be saved right now because the platform secret key is not set up. Nothing was stored. Please contact support.'));
    throw e;
  }
}

/**
 * The vendor's side of the bridge: the inbox, responses, payment methods, orders, invoices, offers and stock. The caller has already been checked (owner or a member with the area, and the plan
 * features requests.inbox and payments.vendor_methods through @RequiresFeature); every method here still takes the vendor id from the verified principal and finds rows ONLY by it, so another
 * vendor's request, order, invoice or payment method answers exactly like one that does not exist.
 */
@Injectable()
export class VendorRequestsService {
  clock: () => Date = () => new Date();

  constructor(
    private readonly store: RequestsStore, private readonly messaging: MessagingService, private readonly gateway: OwnGatewayGate, private readonly lifecycle: LifecycleStore,
    @Inject(B3SettingsService) private readonly b3: Pick<B3SettingsService, 'get'>, @Optional() @Inject(AcceptanceGuard) private readonly acceptance?: AcceptanceGuard,
  ) {}

  // ── inbox ──
  async inbox(vendorId: string, f: RequestFilter) {
    const { items, total } = await this.store.listRequests(vendorId, f);
    const all = (await this.store.listRequests(vendorId, { ...f, skip: 0, take: 500 })).items;
    return { items: items.map((r) => this.view(r)), total, summary: summarise(all) };
  }

  private view(r: Awaited<ReturnType<RequestsStore['getRequest']>> & object) {
    return { id: r.id, kind: r.kind, status: r.status, customerName: r.customerName, customerPhone: r.customerPhoneE164, customerEmail: r.customerEmail, payload: r.payload, source: r.sourceKind, createdAt: r.createdAt, firstSeenAt: r.firstSeenAt, firstResponseAt: r.firstResponseAt, expiresAt: r.expiresAt, convertedCustomerId: r.convertedCustomerId, convertedBookingId: r.convertedBookingId };
  }

  /** Reading a request the first time marks it SEEN (automatic, with an event). */
  async open(vendorId: string, id: string) {
    let r = await this.store.getRequest(id, vendorId);
    if (!r || r.status === 'SPAM') throw nf('REQUEST_NOT_FOUND', 'That request does not exist.');
    if (!r.firstSeenAt) {
      const now = this.clock();
      if (r.status === 'RECEIVED' || r.status === 'DELIVERED') r = (await this.store.transition(r.id, r.status, 'SEEN', { firstSeenAt: now }, { type: 'SEEN', actorType: 'VENDOR' })) ?? r;
    }
    const events = await this.store.events(r.id);
    const order = r.kind === 'ORDER' || r.kind === 'ORDER_REQUEST' ? await this.store.orderByRequest(r.id) : null;
    return { ...this.view(r), events: events.map((e) => ({ type: e.type, actor: e.actorType, at: e.at, channel: e.channel, result: e.deliveryResult, message: typeof e.meta.message === 'string' ? e.meta.message : undefined })), order: order ? { id: order.order.id, orderNo: order.order.orderNo, status: order.order.status } : null };
  }

  /** A reply (a message to the customer, and/or a status move). The first reply stamps firstResponseAt. A status move must be one the vendor may make. */
  async respond(vendorId: string, id: string, b: { status?: RequestStatus; message?: string }, actor: Actor) {
    const r = await this.store.getRequest(id, vendorId);
    if (!r || r.status === 'SPAM') throw nf('REQUEST_NOT_FOUND', 'That request does not exist.');
    const message = b.message === undefined ? null : str(b.message, 1, 1000);
    if (b.message !== undefined && !message) throw new BadRequestException(b3Error('REQUEST_INVALID', 'The message must be 1 to 1000 characters.'));
    if (!message && !b.status) throw new BadRequestException(b3Error('REQUEST_INVALID', 'Give a message or a new status.'));
    const now = this.clock(); let cur = r;
    if (b.status && b.status !== cur.status) {
      if (!vendorMayMove(cur.status, b.status)) throw new ConflictException(b3Error('REQUEST_STATE_INVALID', `A request that is ${cur.status} cannot become ${b.status}.`));
      const moved = await this.store.transition(cur.id, cur.status, b.status, { firstSeenAt: now, firstResponseAt: b.status !== 'SEEN' ? now : undefined }, { type: 'STATUS', actorType: 'VENDOR', meta: { status: b.status } });
      if (!moved) throw new ConflictException(b3Error('REQUEST_STATE_INVALID', 'Someone just changed this request. Reload it.'));
      cur = moved;
    }
    if (message) {
      await this.store.addEvent(cur.id, { type: 'VENDOR_REPLY', actorType: 'VENDOR', meta: { message } }, now);
      if (!cur.firstResponseAt && cur.status === r.status) {
        // a reply without a status move: RECEIVED, DELIVERED or SEEN becomes RESPONDED and the first-response time is stamped
        const to: RequestStatus = 'RESPONDED';
        if (vendorMayMove(cur.status, to)) cur = (await this.store.transition(cur.id, cur.status, to, { firstSeenAt: now, firstResponseAt: now }, { type: 'STATUS', actorType: 'VENDOR', meta: { status: to } })) ?? cur;
      }
      const v = await this.lifecycle.vendor(vendorId);
      await this.messaging.send({ vendorId, to: { phone: cur.customerPhoneE164, email: cur.customerEmail }, templateKey: 'request_responded_customer', vars: { customerName: cur.customerName, businessName: v?.businessName ?? '', reference: cur.id }, relatedRequestId: cur.id, bridge: true });
    }
    await this.store.recordAudit(actor, 'request.respond', 'request', cur.id, { status: r.status }, { status: cur.status });
    return this.view(cur);
  }

  /** The CRM and booking modules arrive later: this only records the ids so the link is not lost. */
  async link(vendorId: string, id: string, links: { customerId?: string; bookingId?: string }, actor: Actor) {
    const ids = [links.customerId, links.bookingId].filter((x): x is string => typeof x === 'string');
    if (!ids.length || ids.some((x) => !/^[A-Za-z0-9_-]{1,64}$/.test(x))) throw new BadRequestException(b3Error('REQUEST_INVALID', 'Give a customer id or a booking id.'));
    const r = await this.store.setLinks(id, vendorId, links);
    if (!r) throw nf('REQUEST_NOT_FOUND', 'That request does not exist.');
    await this.store.recordAudit(actor, 'request.link', 'request', id, null, links);
    return this.view(r);
  }

  // ── payment methods (write-only secrets) ──
  async listMethods(vendorId: string) { return (await this.store.listMethods(vendorId)).map((m) => ({ id: m.id, kind: m.kind, label: m.label, last4: m.last4, status: m.status, verifiedAt: m.verifiedAt, hasGatewayDetails: m.hasSecret, hasWebhookSecret: m.hasWebhookSecret })); }

  async createMethod(vendorId: string, b: { kind: MethodKind; label: string; details?: string; webhookSecret?: string }, actor: Actor) {
    const label = str(b.label, 2, 60); if (!label) throw new BadRequestException(b3Error('PAYMENT_METHOD_INVALID', 'Give the method a name of 2 to 60 characters.'));
    const online = b.kind === 'OWN_GATEWAY' || b.kind === 'UPI';
    if (online && !str(b.details, 4, 300)) throw new BadRequestException(b3Error('PAYMENT_METHOD_INVALID', 'Add the gateway key or the UPI address.'));
    const config = b.details ? sealOrFail(b.details.trim()) : null;
    const web = b.webhookSecret ? sealOrFail(b.webhookSecret.trim()) : null;
    const m = await this.store.createMethod({ vendorId, kind: b.kind, label, last4: config?.last4 ?? null, config: { cipher: config?.cipher ?? null, iv: config?.iv ?? null, tag: config?.tag ?? null }, webhook: { cipher: web?.cipher ?? null, iv: web?.iv ?? null, tag: web?.tag ?? null } });
    await this.store.recordAudit(actor, 'payment_method.create', 'payment_method', m.id, null, { kind: m.kind, label: m.label });   // never the details
    return (await this.listMethods(vendorId)).find((x) => x.id === m.id)!;
  }

  async updateMethod(vendorId: string, id: string, b: { label?: string; status?: MethodStatus; details?: string; webhookSecret?: string }, actor: Actor) {
    const cur = await this.store.getMethod(id, vendorId);
    if (!cur) throw nf('PAYMENT_METHOD_INVALID', 'That payment method does not exist.');
    const patch: Parameters<RequestsStore['updateMethod']>[2] = {};
    if (b.label !== undefined) { const l = str(b.label, 2, 60); if (!l) throw new BadRequestException(b3Error('PAYMENT_METHOD_INVALID', 'The name must be 2 to 60 characters.')); patch.label = l; }
    if (b.details !== undefined) { const d = str(b.details, 4, 300); if (!d) throw new BadRequestException(b3Error('PAYMENT_METHOD_INVALID', 'The details are not valid.')); const sealed = sealOrFail(d); patch.config = { cipher: sealed.cipher, iv: sealed.iv, tag: sealed.tag }; patch.last4 = sealed.last4; patch.verifiedAt = null; if (cur.status === 'ACTIVE') patch.status = 'UNVERIFIED'; }
    if (b.webhookSecret !== undefined) { const w = str(b.webhookSecret, 8, 300); if (!w) throw new BadRequestException(b3Error('PAYMENT_METHOD_INVALID', 'The webhook secret must be 8 to 300 characters.')); const sealed = sealOrFail(w); patch.webhook = { cipher: sealed.cipher, iv: sealed.iv, tag: sealed.tag }; }
    if (b.status !== undefined) {
      if (b.status === 'ACTIVE') {
        // activation: the terms must be accepted (slice 5.15), and an online method must have passed its test after its details were last changed
        if (this.acceptance) await this.acceptance.require(vendorId, REQUIRED_TERMS);
        const online = cur.kind === 'OWN_GATEWAY' || cur.kind === 'UPI';
        if (online && (patch.verifiedAt === null || !cur.verifiedAt)) throw new ConflictException(b3Error('PAYMENT_METHOD_INVALID', 'Test this method first.'));
        if (online && !cur.hasSecret && !patch.config) throw new ConflictException(b3Error('PAYMENT_METHOD_INVALID', 'Add the gateway details first.'));
      }
      if (b.status !== 'ACTIVE' || patch.status === undefined) patch.status = b.status;
    }
    const m = await this.store.updateMethod(id, vendorId, patch);
    if (!m) throw nf('PAYMENT_METHOD_INVALID', 'That payment method does not exist.');
    await this.store.recordAudit(actor, 'payment_method.update', 'payment_method', id, { status: cur.status }, { status: m.status, label: m.label });
    return (await this.listMethods(vendorId)).find((x) => x.id === id)!;
  }

  async testMethod(vendorId: string, id: string, actor: Actor) {
    const m = await this.store.getMethod(id, vendorId);
    if (!m) throw nf('PAYMENT_METHOD_INVALID', 'That payment method does not exist.');
    let result;
    try { result = await this.gateway.get().test({ kind: m.kind, hasSecret: m.hasSecret }); } catch { throw new ConflictException(b3Error('PAYMENT_METHOD_INVALID', 'Live gateway checks are not available yet.')); }
    if (result.ok) await this.store.updateMethod(id, vendorId, { verifiedAt: this.clock() });
    await this.store.recordAudit(actor, 'payment_method.test', 'payment_method', id, null, { ok: result.ok, mode: result.mode });
    return { ok: result.ok, mode: result.mode, message: result.message };
  }

  /** The vendor's webhook secret, opened only inside the webhook service; exposed here for that one caller. */
  async openWebhookSecret(vendorId: string, id: string): Promise<string | null> {
    const s = await this.store.methodSecrets(id, vendorId); return s ? openSecret(s.webhook) : null;
  }

  // ── orders and invoices ──
  async orders(vendorId: string, f: { status?: OrderStatus; skip: number; take: number }) { return this.store.listOrders(vendorId, f); }
  async order(vendorId: string, id: string) { const o = await this.store.getOrder(id, vendorId); if (!o) throw nf('ORDER_INVALID', 'That order does not exist.'); return o; }

  /**
   * Status updates: packed, shipped (with tracking), delivered, cancelled, returned. PAID is recorded here ONLY for an order the customer pays outside the vendor's gateway (cash on delivery, at the
   * visit, a bank transfer); an order waiting for an ONLINE payment becomes PAID only from the vendor gateway event, never by hand. Marking PAID takes the invoice number and reduces the stock, once.
   */
  async updateOrder(vendorId: string, id: string, b: { status: OrderStatus; tracking?: { carrier?: string; reference?: string; url?: string } }, actor: Actor) {
    const cur = await this.order(vendorId, id);
    if (b.status === 'PAID') {
      if (cur.order.paymentMode === 'ONLINE') throw new ConflictException(b3Error('ORDER_INVALID', 'An online order is marked paid by the payment itself.'));
      const r = await this.store.markPaid(id, vendorId, this.clock());
      await this.afterPaid(vendorId, r.order.id, r.alreadyPaid);
      await this.store.recordAudit(actor, 'order.paid_recorded', 'order', id, { status: cur.order.status }, { status: 'PAID' });
      return r.order;
    }
    if (!canMoveOrder(cur.order.status, b.status)) throw new ConflictException(b3Error('ORDER_INVALID', `An order that is ${cur.order.status} cannot become ${b.status}.`));
    const tracking = b.status === 'SHIPPED' ? { carrier: str(b.tracking?.carrier, 1, 60) ?? undefined, reference: str(b.tracking?.reference, 1, 80) ?? undefined, url: typeof b.tracking?.url === 'string' && /^https:\/\//.test(b.tracking.url) ? b.tracking.url.slice(0, 300) : undefined } : undefined;
    const o = await this.store.moveOrder(id, vendorId, cur.order.status, b.status, { tracking: tracking as Record<string, unknown> | undefined });
    if (!o) throw new ConflictException(b3Error('ORDER_INVALID', 'Someone just changed this order. Reload it.'));
    await this.store.addEvent(cur.order.requestId, { type: 'STATUS', actorType: 'VENDOR', meta: { status: o.status, orderStatus: o.status } }, this.clock());
    await this.store.recordAudit(actor, 'order.status', 'order', id, { status: cur.order.status }, { status: o.status });
    return o;
  }

  /** What happens once an order is paid (by the vendor's gateway event or by the vendor): the confirmation message, once. */
  async afterPaid(vendorId: string, orderId: string, alreadyPaid: boolean): Promise<void> {
    if (alreadyPaid) return;
    const o = await this.store.getOrder(orderId, vendorId); if (!o) return;
    const req = await this.store.getRequest(o.order.requestId, vendorId); const v = await this.lifecycle.vendor(vendorId);
    if (req) await this.messaging.send({ vendorId, to: { phone: req.customerPhoneE164, email: req.customerEmail }, templateKey: 'order_confirmed_customer', vars: { customerName: req.customerName, businessName: v?.businessName ?? '', reference: req.id, orderNo: String(o.order.orderNo) }, relatedRequestId: req.id, bridge: true });
  }

  /** A refund is a RECORDED FACT only: no provider is called and no money moves through Get4Domain. */
  async recordRefund(vendorId: string, id: string, amountPaise: number, actor: Actor) {
    const cur = await this.order(vendorId, id);
    if (!Number.isInteger(amountPaise) || amountPaise < 1 || cur.order.refundedPaise + amountPaise > cur.order.amountPaise) throw new BadRequestException(b3Error('ORDER_INVALID', 'The refund must be a whole number of paise and cannot exceed what was paid.'));
    if (cur.order.status === 'CANCELLED' || cur.order.status === 'PLACED' || cur.order.status === 'AWAITING_PAYMENT') throw new ConflictException(b3Error('ORDER_INVALID', 'Nothing was paid on this order.'));
    const o = await this.store.recordRefund(id, vendorId, amountPaise);
    await this.store.recordAudit(actor, 'order.refund_recorded', 'order', id, { refundedPaise: cur.order.refundedPaise }, { refundedPaise: o?.refundedPaise });
    return o;
  }

  async invoiceFor(vendorId: string, orderId: string, actor: Actor) {
    const cur = await this.order(vendorId, orderId);
    const existing = (await this.store.listInvoices(vendorId, 0, 500)).items.find((i) => i.orderId === orderId && i.status === 'ISSUED');
    if (existing) return existing;   // one live invoice per order
    const v = await this.lifecycle.vendor(vendorId); const s = await this.b3.get();
    const snapshot = { seller: { businessName: v?.businessName ?? '', note: 'The seller details (legal name, GSTIN, address and tax lines) come from the vendor profile at issue time.' }, orderNo: cur.order.orderNo, currency: cur.order.currency, amountPaise: cur.order.amountPaise, lines: cur.items.map((i) => ({ name: i.name, qty: i.qty, unitPaise: i.unitPaise, tax: i.tax })) };
    const inv = await this.store.createInvoice({ vendorId, orderId, requestId: cur.order.requestId, snapshot, prefix: s.vendorInvoicePrefix, now: this.clock() });
    await this.store.recordAudit(actor, 'invoice.issue', 'invoice', inv.id, null, { invoiceNumber: inv.invoiceNumber, orderId });
    return inv;
  }
  async invoices(vendorId: string, skip: number, take: number) { return this.store.listInvoices(vendorId, skip, take); }
  async voidInvoice(vendorId: string, id: string, reason: string, actor: Actor) {
    const r = str(reason, 5, 300); if (!r) throw new BadRequestException(b3Error('LIFECYCLE_REASON_REQUIRED' as never, 'A reason of 5 to 300 characters is required.'));
    const inv = await this.store.voidInvoice(id, vendorId, r, this.clock());
    if (!inv) throw nf('ORDER_INVALID', 'That invoice does not exist.');
    await this.store.recordAudit(actor, 'invoice.void', 'invoice', id, null, { reason: r });
    return inv;
  }

  // ── offers and stock ──
  async offers(vendorId: string) { return this.store.listOffers(vendorId); }
  async createOffer(vendorId: string, b: { kind: 'BANNER' | 'COUPON'; title: string; code?: string; percentOff?: number; flatPaise?: number; minOrderPaise?: number; startsAt?: string; endsAt?: string; usageLimit?: number }, actor: Actor) {
    const title = str(b.title, 2, 80); if (!title) throw new BadRequestException(b3Error('OFFER_INVALID', 'The title must be 2 to 80 characters.'));
    const code = b.code ? b.code.trim().toUpperCase() : null;
    if (b.kind === 'COUPON' && !(code && /^[A-Z0-9_-]{3,20}$/.test(code))) throw new BadRequestException(b3Error('OFFER_INVALID', 'A coupon needs a code of 3 to 20 letters or digits.'));
    const pct = b.percentOff ?? null; const flat = b.flatPaise ?? null;
    if ((pct === null) === (flat === null) || (pct !== null && (!Number.isInteger(pct) || pct < 1 || pct > 100)) || (flat !== null && (!Number.isInteger(flat) || flat < 1 || flat > 100_000_000))) throw new BadRequestException(b3Error('OFFER_INVALID', 'Give either a percentage (1 to 100) or a flat amount in paise.'));
    const startsAt = b.startsAt ? new Date(b.startsAt) : null; const endsAt = b.endsAt ? new Date(b.endsAt) : null;
    if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime())) || (startsAt && endsAt && endsAt <= startsAt)) throw new BadRequestException(b3Error('OFFER_INVALID', 'The dates are not valid.'));
    try {
      const o = await this.store.createOffer({ vendorId, kind: b.kind, title, code: b.kind === 'COUPON' ? code : null, percentOff: pct, flatPaise: flat, minOrderPaise: b.minOrderPaise ?? 0, startsAt, endsAt, usageLimit: b.usageLimit ?? null, status: 'ACTIVE' });
      await this.store.recordAudit(actor, 'offer.create', 'offer', o.id, null, { kind: o.kind, code: o.code });
      return o;
    } catch (e) { if ((e as { code?: string })?.code === 'P2002') throw new ConflictException(b3Error('OFFER_INVALID', 'You already have an offer with that code.')); throw e; }
  }
  async updateOffer(vendorId: string, id: string, b: Partial<Pick<OfferRow, 'title' | 'percentOff' | 'flatPaise' | 'minOrderPaise' | 'usageLimit' | 'status'>> & { startsAt?: string | null; endsAt?: string | null }, actor: Actor) {
    const patch = { ...b, startsAt: b.startsAt === undefined ? undefined : b.startsAt ? new Date(b.startsAt) : null, endsAt: b.endsAt === undefined ? undefined : b.endsAt ? new Date(b.endsAt) : null };
    const o = await this.store.updateOffer(id, vendorId, JSON.parse(JSON.stringify(patch), (k, v) => (k === 'startsAt' || k === 'endsAt') && typeof v === 'string' ? new Date(v) : v));
    if (!o) throw nf('OFFER_INVALID', 'That offer does not exist.');
    await this.store.recordAudit(actor, 'offer.update', 'offer', id, null, { status: o.status });
    return o;
  }
  async setStock(vendorId: string, productRef: string, onHand: number) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(productRef) || !Number.isInteger(onHand) || onHand < 0 || onHand > 1_000_000) throw new BadRequestException(b3Error('REQUEST_INVALID', 'A product reference and a whole stock number are needed.'));
    await this.store.setStock(vendorId, productRef, onHand);
    return { productRef, ...(await this.store.getStock(vendorId, productRef)) };
  }
}
export type { RequestKind };
