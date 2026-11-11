import { BadRequestException, ConflictException, GoneException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { b3Error } from '../b3-settings/b3-errors';
import { B3SettingsService } from '../b3-settings/b3-settings.service';
import { Actor } from '../plans/admin/audit.service';
import { EntitlementsService } from '../plans/entitlements/entitlements.service';
import { normalisePhoneE164 } from '../directory/core/otp';
import { KeyedQueue } from '../common/keyed-queue';
import { MessagingService } from '../requests-orders/messaging.service';
import { RequestsStore } from '../requests-orders/requests.store';
import { VendorRequestsService } from '../requests-orders/vendor-requests.service';
import { ActivityService } from '../v3-activity/activity.service';
import { TakedownPort } from '../v3-trust/trust.ports';
import { LifecycleStore } from '../vendor-lifecycle/lifecycle.store';
import { amountString, buildUpiIntent, isPayCode, normaliseUtr, nextPayStatus, PayStatus, payCodeFrom } from './core/pay-core';
import { DocumentsService } from './documents.service';
import { PayCodeTaken, PayRequestRow, PaymentsStore } from './payments.store';

const nf = (): NotFoundException => new NotFoundException(b3Error('PAY_REQUEST_NOT_FOUND', 'That payment request does not exist.'));
const bad = (msg: string): BadRequestException => new BadRequestException(b3Error('PAY_REQUEST_INVALID', msg));
const plain404 = (): NotFoundException => new NotFoundException('Not found');
const str = (v: unknown, min: number, max: number): string | null => { if (typeof v !== 'string') return null; const t = v.trim().replace(/\s+/g, ' '); return t.length >= min && t.length <= max ? t : null; };
/** One lock per vendor, taken BEFORE any transaction opens (stop-line 7). */
export const payQueue = new KeyedQueue();

const view = (r: PayRequestRow, payUrl: string) => ({
  id: r.id, code: r.code, payUrl: `${payUrl}/${r.code}`, amountPaise: r.amountPaise, amountText: amountString(r.amountPaise), note: r.note, customerName: r.customerName, customerPhone: r.customerPhone,
  source: r.source, requestId: r.requestId, orderId: r.orderId, methodId: r.methodId, status: r.status, expiresAt: r.expiresAt, customerSaidAt: r.customerSaidAt, customerUtr: r.customerUtr, createdAt: r.createdAt,
});

/**
 * Pay requests (slice 5.17b, owner amendment 06). The vendor makes a request for an amount; the customer opens the public pay page, pays in their own UPI app and taps "I have paid"; the vendor checks
 * their own bank app and taps "Mark as paid". That tap is the ONLY route to PAID: the customer's tap never marks anything paid. Get4Domain never touches the money.
 */
@Injectable()
export class PaymentsService {
  clock: () => Date = () => new Date();
  random: () => Uint8Array = () => randomBytes(24);

  constructor(
    private readonly store: PaymentsStore, private readonly requests: RequestsStore, private readonly vendors: VendorRequestsService, private readonly lifecycle: LifecycleStore,
    @Inject(B3SettingsService) private readonly b3: Pick<B3SettingsService, 'get'>, private readonly ents: EntitlementsService, private readonly messaging: MessagingService,
    @Inject('PUBLIC_PAY_URL') private readonly payUrl: string, @Optional() private readonly activity?: ActivityService, @Optional() private readonly takedowns?: TakedownPort,
    @Optional() private readonly documents?: DocumentsService,
  ) {}

  private async record(vendorId: string, actor: { type: 'VENDOR' | 'STAFF' | 'SYSTEM' | 'VENDOR_USER'; id: string | null; ip?: string | null }, actionKey: string, id: string, summary: Record<string, unknown>): Promise<void> {
    await this.activity?.record({ vendorId, actor, actionKey, entityType: 'payment_request', entityId: id, summary });
  }

  // ── the owner's side ──
  async create(vendorId: string, b: { amountPaise?: unknown; note?: unknown; customerName?: unknown; customerPhone?: unknown; methodId?: unknown; orderId?: unknown }, actor: Actor): Promise<ReturnType<typeof view>> {
    const s = await this.b3.get();
    if (s.payLinkExpiryHours === null || s.payLinkExpiryHours === undefined) throw new ConflictException(b3Error('PAY_LINK_EXPIRY_NOT_SET', 'Payment links are not available yet. Our team must set how long a link stays valid.'));
    const customerName = str(b.customerName, 2, 80); if (!customerName) throw bad('customerName: 2 to 80 characters');
    let customerPhone: string | null = null; if (typeof b.customerPhone === 'string' && b.customerPhone.trim()) { customerPhone = normalisePhoneE164(b.customerPhone); if (!customerPhone) throw bad('customerPhone: not a valid mobile number'); }
    const note = b.note === undefined || b.note === null || b.note === '' ? null : str(b.note, 1, 200); if (b.note !== undefined && b.note !== null && b.note !== '' && !note) throw bad('note: up to 200 characters');
    let amountPaise = b.amountPaise; let orderId: string | null = null; let requestId: string | null = null; let source: 'MANUAL' | 'ORDER' = 'MANUAL';
    if (b.orderId !== undefined && b.orderId !== null && b.orderId !== '') {
      const o = typeof b.orderId === 'string' ? await this.requests.getOrder(b.orderId, vendorId) : null;   // another vendor's order answers like one that does not exist
      if (!o) throw nf();
      if (o.order.status !== 'AWAITING_PAYMENT' && o.order.status !== 'PLACED') throw new ConflictException(b3Error('PAY_STATE_INVALID', 'This order is not waiting for payment.'));
      if (amountPaise !== undefined && amountPaise !== o.order.amountPaise) throw bad('amountPaise: must equal the order total');
      amountPaise = o.order.amountPaise; orderId = o.order.id; requestId = o.order.requestId; source = 'ORDER';
    }
    if (amountString(amountPaise) === null) throw bad('amountPaise: a whole number of paise greater than zero');
    const methods = await this.requests.listMethods(vendorId);
    const method = typeof b.methodId === 'string' && b.methodId ? methods.find((m) => m.id === b.methodId) : methods.find((m) => m.isDefault && m.status === 'ACTIVE');
    if (!method || method.kind !== 'UPI' || method.status !== 'ACTIVE' || !method.upiId || !method.payeeName) throw new ConflictException(b3Error('PAYMENT_METHOD_INVALID', 'Turn on a UPI method first (and make it the default, or choose it).'));
    const now = this.clock(); const expiresAt = new Date(now.getTime() + s.payLinkExpiryHours * 3_600_000);
    let row: PayRequestRow | null = null;
    for (let i = 0; i < 3 && !row; i++) {
      try { row = await this.store.create({ vendorId, code: payCodeFrom(this.random()), amountPaise: amountPaise as number, note, customerName, customerPhone, source, requestId, orderId, methodId: method.id, expiresAt, createdBy: actor.id }); } catch (e) { if (!(e instanceof PayCodeTaken)) throw e; }
    }
    if (!row) throw new ConflictException(b3Error('PAY_REQUEST_INVALID', 'Try again.'));
    await this.record(vendorId, { type: 'VENDOR', id: actor.id }, 'payment_request.created', row.id, { amountPaise: row.amountPaise, source });
    return view(row, this.payUrl);
  }

  async list(vendorId: string, f: { status?: PayStatus; orderId?: string; skip: number; take: number }) {
    const r = await this.store.list(vendorId, f); return { items: r.items.map((x) => view(x, this.payUrl)), total: r.total };
  }
  async get(vendorId: string, id: string) {
    const r = await this.store.byId(id, vendorId); if (!r) throw nf();
    const payment = await this.store.paymentOf(id, vendorId);
    return { ...view(r, this.payUrl), payment: payment ? { amountPaise: payment.amountPaise, utr: payment.utr, confirmedBy: payment.confirmedBy, confirmedAt: payment.confirmedAt } : null };
  }

  async cancel(vendorId: string, id: string, actor: Actor) {
    const cur = await this.store.byId(id, vendorId); if (!cur) throw nf();
    if (nextPayStatus(cur.status, 'VENDOR_CANCELS') === null) throw new ConflictException(b3Error('PAY_STATE_INVALID', `A request that is ${cur.status} cannot be cancelled.`));
    const r = await this.store.cancel(id, vendorId); if (!r) throw new ConflictException(b3Error('PAY_STATE_INVALID', 'Someone just changed this request. Reload it.'));
    await this.record(vendorId, { type: 'VENDOR', id: actor.id }, 'payment_request.cancelled', id, {});
    return view(r, this.payUrl);
  }

  /** Mark as paid: the only way a request, and the order behind it, becomes PAID. Idempotent: the second call returns the same payment and changes nothing. */
  async markPaid(vendorId: string, id: string, b: { utr?: unknown; idempotencyKey?: unknown }, actor: Actor) {
    const utr = normaliseUtr(b.utr); if (!utr.ok) throw new BadRequestException(b3Error('PAY_REFERENCE_INVALID', 'The UPI reference must be 8 to 22 letters and digits, or left empty.'));
    const key = b.idempotencyKey === undefined || b.idempotencyKey === null ? null : (typeof b.idempotencyKey === 'string' && /^[A-Za-z0-9._-]{8,80}$/.test(b.idempotencyKey) ? b.idempotencyKey : undefined);
    if (key === undefined) throw bad('idempotencyKey: 8 to 80 letters, digits, dots, dashes or underscores');
    const cur = await this.store.byId(id, vendorId); if (!cur) throw nf();
    if (nextPayStatus(cur.status, 'VENDOR_MARKS_PAID') === null) throw new ConflictException(b3Error('PAY_STATE_INVALID', 'A cancelled request cannot be marked paid.'));
    const r = await payQueue.run(`pay:${vendorId}`, () => this.store.confirmPaid(id, vendorId, { utr: utr.utr, idempotencyKey: key, now: this.clock() }));
    if (!r) throw new ConflictException(b3Error('PAY_STATE_INVALID', 'This request cannot be marked paid.'));
    if (!r.alreadyPaid) {
      if (r.request.orderId) await this.vendors.recordOrderPaid(vendorId, r.request.orderId);
      await this.record(vendorId, { type: 'VENDOR', id: actor.id }, 'payment.marked_paid', id, { amountPaise: r.payment.amountPaise, level: 1 });
    }
    // the receipt or invoice: made once per payment, and asked for again on a repeat call in case the first attempt failed; a fault here never undoes the payment
    let document: { id: string; number: string; kind: string } | null = null;
    try { const d = await this.documents?.createForPayment(vendorId, id); if (d?.doc) document = { id: d.doc.id, number: d.doc.number, kind: d.doc.kind }; } catch { /* the payment stands */ }
    return { ...view(r.request, this.payUrl), alreadyPaid: r.alreadyPaid, document, payment: { amountPaise: r.payment.amountPaise, utr: r.payment.utr, confirmedBy: r.payment.confirmedBy, confirmedAt: r.payment.confirmedAt } };
  }

  /** The expiry job: every AWAITING request whose time has passed becomes EXPIRED. Safe to repeat and to run twice at once (each change is compare-and-set). */
  async expireDue(limit = 200): Promise<number> {
    const now = this.clock(); let n = 0;
    for (const r of await this.store.expirable(now, limit)) if (await this.store.expire(r.id, now)) n++;
    return n;
  }

  // ── the public pay page ──
  /** Finds the request by its code and applies the same public gate as the rest of the bridge: anything that must reveal nothing is ONE plain 404. */
  private async gate(codeIn: unknown) {
    if (!isPayCode(codeIn)) throw plain404();
    const row = await this.store.byCode(codeIn); if (!row) throw plain404();
    const vendor = await this.lifecycle.vendor(row.vendorId);
    if (!vendor || vendor.status === 'SUSPENDED' || (await this.lifecycle.isRemoved(row.vendorId))) throw plain404();
    if (this.takedowns && (await this.takedowns.activeForVendor(row.vendorId))) throw plain404();
    if ((await this.ents.resolve(row.vendorId)).features['payments.vendor_methods']?.state !== 'ACTIVE') throw plain404();   // a Free vendor has no pay page
    return { row, vendor };
  }
  private gone(): GoneException { return new GoneException(b3Error('PAY_LINK_EXPIRED', 'This payment link is no longer valid. Please ask the business for a new one.')); }

  /** What the pay page needs and no more: business name, payee name, amount, note, the QR payload and the state. No phone number, no customer name. */
  async publicView(code: string) {
    const { row, vendor } = await this.gate(code);
    if (row.status === 'PAID') return { state: 'PAID' as const, businessName: vendor.businessName, amountText: amountString(row.amountPaise) };
    if (row.status === 'CANCELLED' || row.status === 'EXPIRED') throw this.gone();
    if (row.status === 'AWAITING' && row.expiresAt <= this.clock()) { await this.store.expire(row.id, this.clock()); throw this.gone(); }
    const method = (await this.requests.listMethods(row.vendorId)).find((m) => m.id === row.methodId);
    const intent = method?.upiId && method.payeeName ? buildUpiIntent({ pa: method.upiId, pn: method.payeeName, amountPaise: row.amountPaise, note: row.note }) : null;
    if (!intent) throw plain404();
    return { state: row.status, businessName: vendor.businessName, payeeName: method!.payeeName, amountPaise: row.amountPaise, amountText: amountString(row.amountPaise), note: row.note, upiIntent: intent, qrPayload: intent, expiresAt: row.expiresAt };
  }

  /** The customer's tap. It records the claim and tells the vendor; it NEVER marks anything paid. Repeating it changes nothing. */
  async iHavePaid(code: string, body: { utr?: unknown }) {
    const utr = normaliseUtr(body?.utr); if (!utr.ok) throw new BadRequestException(b3Error('PAY_REFERENCE_INVALID', 'The UPI reference must be 8 to 22 letters and digits, or left empty.'));
    const { row, vendor } = await this.gate(code);
    if (row.status === 'PAID' || row.status === 'CUSTOMER_SAYS_PAID') return { state: row.status };
    if (row.status === 'CANCELLED' || row.status === 'EXPIRED') throw this.gone();
    if (row.expiresAt <= this.clock()) { await this.store.expire(row.id, this.clock()); throw this.gone(); }
    const r = await this.store.customerTaps(row.id, utr.utr, this.clock());
    if (!r) return { state: (await this.store.byCode(code))?.status ?? 'AWAITING' };   // lost a race: the answer is whatever it is now
    try { await this.messaging.send({ vendorId: row.vendorId, to: { phone: vendor.phone, email: vendor.email }, templateKey: 'payment_said_paid_vendor', vars: { customerName: '', businessName: vendor.businessName, reference: row.id, amount: `Rs ${amountString(row.amountPaise)}` } }); } catch { /* a failed notice never undoes the customer's tap */ }
    await this.record(row.vendorId, { type: 'SYSTEM', id: null }, 'payment_request.customer_says_paid', row.id, { amountPaise: row.amountPaise, hasReference: !!utr.utr });
    return { state: r.status };
  }
}
