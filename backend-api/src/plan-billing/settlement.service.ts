import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ActivityBus } from '../common/activity-bus';
import { createHash } from 'crypto';
import { Actor } from '../plans/admin/audit.service';
import { adminGapError } from '../v3-admin-gaps/admin-gaps.errors';
import { EntitlementsService } from '../plans/entitlements/entitlements.service';
import { financialYearOf, formatInvoiceNumber, renewalEnd, verifyPaidAmount } from './core/amounts';
import { canTransitionOrder, OrderStatus } from './core/order-state';
import { redactPaymentPayload } from './core/redact';
import { billingError, ORDER_NOT_FOUND_MESSAGE } from './plan-billing.errors';
import { BillingTx, OrderRow, PlanBillingRepository } from './plan-billing.repository';
import { GatewayName, isGatewayName } from './gateway/gateway-core';
import { GatewayHeaders } from './gateway/gateway.port';
import { PaymentsGate } from './razorpay/payments-gate';
import { BillingSettings } from './settings/billing-settings';
import { BillingSettingsService } from './settings/billing-settings.service';
import { CashInput, checkCashConfirmation } from './core/cash-core';
import { invoiceLines } from './core/invoice-lines';
import { PlanInvoiceDeliveryService } from './invoice-delivery.service';
import { PlanPaidHook } from './plan-paid.hook';
import { TopupSettlementHook } from './topup-hook';

/** what a settlement hands back to its caller besides the outcome: the plan level, and the invoice it made (for the mail) */
export interface SettleCtx { planLevel: string | null; invoice?: { id: string; number: string; planName: string; to: string | null } }
export type SettleOutcome = 'PAID' | 'ALREADY_PAID' | 'REVIEW' | 'IGNORED' | 'NO_ORDER';
/** C6: what staff recorded when they marked an order paid offline, stored on the order in the same transaction as the payment */
export interface OfflineSettle { reference: string | null; receivedOn: Date | null; amountPaise: number | null; byName: string }
export interface SettleInput { orderId: string; paid: { paymentId: string; amount: number; currency: string }; via: 'CONFIRM' | 'WEBHOOK' | 'STAFF' | 'WALLET'; actor: Actor; reason: string | null; offline?: OfflineSettle }
const SYSTEM: Actor = { type: 'SYSTEM', id: null, ip: null };

/**
 * The ONE place a plan is paid for (slice 5.1b). The browser confirmation, the provider webhook and a staff "paid offline" all end here, under a per-vendor lock, in one transaction:
 * re-read the order, check the amount and currency against the order snapshot, then create or extend the subscription through the slice 5.1 SubscriptionsService, write the invoice
 * (gap-free number), the order's PAID state and the audit row, or none of it. A second caller finds the order PAID and changes nothing, so a double confirm, a duplicate webhook or a
 * confirm racing a webhook give exactly ONE subscription extension. A mismatch, or money for a closed order, goes to REVIEW and never activates anything.
 */
@Injectable()
export class PaymentSettlementService {
  clock: () => Date = () => new Date();
  constructor(
    private readonly repo: PlanBillingRepository, @Inject(BillingSettingsService) private readonly settings: Pick<BillingSettingsService, 'get'>, @Inject(PaymentsGate) private readonly gate: Pick<PaymentsGate, 'webhookPort'> & Partial<Pick<PaymentsGate, 'webhookGatewayPort'>>,
    @Inject(EntitlementsService) private readonly entitlements: Pick<EntitlementsService, 'invalidate'>,
    /** Batch 4: the wallet's top-ups are paid through the same webhook; asked only when the provider order is not a plan order. Absent = plan payments only (nothing changes). */
    @Optional() @Inject(TopupSettlementHook) private readonly topups?: TopupSettlementHook,
    /** Batch 4: says "a plan order was paid" after the work is committed (the wallet opens on it). Absent = nobody is told. */
    @Optional() @Inject(ActivityBus) private readonly bus?: Pick<ActivityBus, 'emit'>,
    /** Wave 3 Part D: records (and, when the mail switch is on, sends) the invoice mail after the payment is committed. Absent = no mail is recorded. */
    @Optional() @Inject(PlanInvoiceDeliveryService) private readonly delivery?: Pick<PlanInvoiceDeliveryService, 'queue'>,
    /** Wave 3 Part I: told after a plan payment commits (the referral module makes the first-payment commission line) and after a full refund is recorded. Absent = nobody is told. */
    @Optional() @Inject(PlanPaidHook) private readonly paidHook?: PlanPaidHook,
  ) {}

  async settle(i: SettleInput, ctxOut?: SettleCtx): Promise<SettleOutcome> {
    const order = await this.repo.getOrder(i.orderId);
    if (!order) return 'NO_ORDER';
    const s = await this.settings.get();
    const ctx: SettleCtx = ctxOut ?? { planLevel: null };
    const outcome = await this.repo.transaction(order.vendorId, (tx) => this.settleWithin(tx, i, s, ctx));
    if (outcome === 'PAID') {
      this.afterPaid(order.vendorId, order.id, ctx.planLevel, i);
      // the invoice mail is recorded AFTER the commit and never raises: the payment and the invoice do not depend on it
      // a plan payment of a referred vendor makes the commission line (the vendor's FIRST one only; the hook checks) after the commit; it never raises into the payment
      if (this.paidHook) void this.paidHook.onPlanPaid({ vendorId: order.vendorId, orderId: order.id, paidAt: this.clock(), via: i.via }).catch(() => undefined);
      if (ctx.invoice && this.delivery) void this.delivery.queue({ invoiceId: ctx.invoice.id, invoiceNumber: ctx.invoice.number, planName: ctx.invoice.planName, vendorId: order.vendorId, to: ctx.invoice.to }).catch(() => undefined);
    }
    return outcome;
  }

  /** What follows a committed payment: the entitlements are forgotten and whoever listens is told (the wallet opens on it). Called by settle() and by plan renewal from the wallet. */
  afterPaid(vendorId: string, orderId: string, planLevel: string | null, i: Pick<SettleInput, 'via' | 'actor'>): void {
    this.entitlements.invalidate(vendorId);
    void this.bus?.emit({ type: 'plan.order.paid', vendorId, at: this.clock(), actor: { type: i.actor.type, id: i.actor.id }, data: { orderId, planLevel, via: i.via } });
  }

  /**
   * The body of a settlement, inside a transaction the CALLER opened: the online and offline paths wrap it in their own, plan renewal from the wallet runs it in the same transaction as the
   * wallet charge so the charge, the paid order, the term and the invoice commit together or not at all. Settings are read by the caller BEFORE the transaction opens.
   */
  async settleWithin(tx: BillingTx, i: SettleInput, s: BillingSettings, ctx: SettleCtx = { planLevel: null }): Promise<SettleOutcome> {
    {

      const o = await tx.getOrder(i.orderId);
      if (!o) return 'NO_ORDER' as const;
      if (o.status === 'PAID') return 'ALREADY_PAID' as const;
      if (o.status === 'FAILED' || o.status === 'CREATED') return 'IGNORED' as const;   // no provider order exists for these: nothing can have been paid against them
      const check = verifyPaidAmount(o, { amount: i.paid.amount, currency: i.paid.currency });
      const closed = o.status === 'EXPIRED' || o.status === 'CANCELLED';
      if (check !== 'OK' || closed) {
        if (!canTransitionOrder(o.status, 'REVIEW') && o.status !== 'REVIEW') return 'IGNORED' as const;
        if (o.status !== 'REVIEW') await tx.updateOrderCas(o.id, [o.status], { status: 'REVIEW', paymentId: i.paid.paymentId, paidAmountPaise: Number.isInteger(i.paid.amount) ? i.paid.amount : null });
        await tx.audit(i.actor, 'billing.order.review', o.id, { status: o.status }, { reason: closed ? `payment for a ${o.status} order` : check, paymentId: i.paid.paymentId, orderPaise: o.amountPaise });
        return 'REVIEW' as const;
      }
      const now = this.clock();
      const plan = await tx.getPlanById(o.planId);
      const vendor = await tx.vendor(o.vendorId);
      if (!plan || !vendor) return 'IGNORED' as const;
      const cur = await tx.currentSub(o.vendorId);
      const base = cur && cur.planId === plan.id && cur.level === 'PRO' ? cur.endsAt : null;   // same plan: extend from the later of now and the end; a different plan starts now
      const endsAt = renewalEnd(base, now, o.termMonths);
      const sub = await tx.assign({ vendorId: o.vendorId, planKey: plan.key, termMonths: o.termMonths, endsAt, source: i.via === 'STAFF' ? 'STAFF' : 'SELF', actor: i.actor, reason: `plan order ${o.id}`, now });
      // A plan paid from the wallet carries no GST and no invoice of its own: the refill already had both (owner, 6 November 2026). Every other way of paying keeps the invoice.
      const invoice = i.via === 'WALLET' ? null : await this.issueInvoice(tx, o, plan, vendor, i, s, endsAt, now);
      if (invoice) ctx.invoice = { id: invoice.id, number: invoice.invoiceNumber, planName: plan.name, to: vendor.email };
      const ok = await tx.updateOrderCas(o.id, [o.status], { status: 'PAID', paymentId: i.paid.paymentId, paidAmountPaise: i.paid.amount, paidAt: now, source: i.via === 'STAFF' ? 'STAFF' : i.via === 'WALLET' ? 'WALLET' : 'SELF', reason: i.reason, subscriptionId: sub.id, ...(i.offline ? { settledReference: i.offline.reference, settledOn: i.offline.receivedOn, settledAmountPaise: i.offline.amountPaise, settledByName: i.offline.byName } : {}) });
      if (!ok) throw new Error('the order changed during settlement');   // rolls the whole transaction back
      await tx.audit(i.actor, 'billing.order.paid', o.id, { status: o.status }, { status: 'PAID', subscriptionId: sub.id, invoice: invoice?.invoiceNumber ?? null, via: i.via, amountPaise: o.amountPaise, ...(i.offline ? { cash: { reference: i.offline.reference, receivedOn: i.offline.receivedOn ? i.offline.receivedOn.toISOString().slice(0, 10) : null, by: i.offline.byName } } : {}) });
      ctx.planLevel = plan.level;
      return 'PAID' as const;
    }
  }

  private async issueInvoice(tx: BillingTx, o: NonNullable<Awaited<ReturnType<BillingTx['getOrder']>>>, plan: { key: string; name: string }, vendor: { businessName: string | null; name: string | null; email: string | null; phone: string | null }, i: SettleInput, s: BillingSettings, endsAt: Date, now: Date) {
    const fy = financialYearOf(now);
    const n = await tx.nextInvoiceNumber(fy);
    const q = o.quote as { discounts?: unknown; base?: number; taxMinor?: number; taxableMinor?: number; taxName?: string; taxRatePercent?: number; taxInclusive?: boolean; creditPaise?: number };
    return await tx.insertInvoice({
        vendorId: o.vendorId, orderId: o.id, invoiceNumber: formatInvoiceNumber(s.invoiceNumberPrefix, fy, n), financialYear: fy, issuedAt: now,
        snapshot: {
          seller: { name: s.invoiceSellerName, address: s.invoiceSellerAddress, gstin: s.invoiceSellerGstin, complete: !!(s.invoiceSellerName && s.invoiceSellerAddress) },
          buyer: { businessName: vendor.businessName, name: vendor.name, email: vendor.email, phone: vendor.phone },
          plan: { key: plan.key, name: plan.name }, termMonths: o.termMonths, period: { from: now.toISOString(), to: endsAt.toISOString() },
          order: { id: o.id, providerOrderId: o.providerOrderId, gateway: o.gateway ?? 'razorpay', paymentId: i.paid.paymentId, via: i.via }, amountPaise: o.amountPaise, currency: o.currency, kind: o.kind,
          // Wave 3 Part D: how it was paid, and the reference the vendor sees: the gateway payment id, or the cash receipt reference an admin recorded
          payment: i.via === 'STAFF' ? { method: 'CASH', reference: i.offline?.reference ?? null, receivedOn: i.offline?.receivedOn ? i.offline.receivedOn.toISOString().slice(0, 10) : null } : { method: 'GATEWAY', gateway: o.gateway ?? 'razorpay', reference: i.paid.paymentId },
          lines: invoiceLines(plan.name, o.termMonths, q, o.amountPaise),
        },
        taxBreakdown: { name: q.taxName ?? null, ratePercent: q.taxRatePercent ?? null, taxInclusive: q.taxInclusive ?? false, taxableMinor: q.taxableMinor ?? null, taxMinor: q.taxMinor ?? 0, creditPaise: q.creditPaise ?? 0, discounts: q.discounts ?? [] },
      });
  }

  // ───────────────────────────────────────────────────────────────────────────────────────── webhook
  /**
   * A signed webhook of ANY gateway (Wave 3 Part C), through the payment port. In order: the adapter of that gateway verifies the signature over the RAW body (a bad one is stored as unverified and answered 401);
   * the event is stored once by its event id (a repeat is a 200 that changes nothing); the order is found by the gateway's order id; a successful payment is settled, and the settlement checks the amount and
   * the currency against the order and HOLDS a mismatch for review (never activates). An event for an order that was started on the OTHER gateway, an unknown order, a failed attempt and any other event
   * activate nothing. Always resolves with a small answer the controller turns into 200 or 401.
   */
  async handleGatewayWebhook(gateway: GatewayName, rawBody: Buffer | string | undefined, headers: GatewayHeaders): Promise<{ status: 'OK' | 'BAD_SIGNATURE' | 'IGNORED'; duplicate?: boolean; result?: string }> {
    const port = typeof this.gate.webhookGatewayPort === 'function' ? await this.gate.webhookGatewayPort(gateway) : null;
    if (!port) return { status: 'IGNORED' };   // payments are off, or this gateway has no keys: nothing to verify against, nothing to do
    const raw = rawBody ?? '';
    const digest = createHash('sha256').update(raw).digest('hex');
    if (!port.verifyWebhook(raw, headers, this.clock())) {
      await this.repo.insertEvent({ providerEventId: `bad-${digest.slice(0, 40)}`, type: 'unverified', payloadRedacted: {}, signatureValid: false, orderId: null, provider: gateway }).catch(() => undefined);
      return { status: 'BAD_SIGNATURE' };
    }
    const ev = port.parseWebhook(raw, headers);
    if (!ev) {   // signed but unreadable: recorded once and ignored
      const { created } = await this.repo.insertEvent({ providerEventId: `unreadable-${digest.slice(0, 40)}`, type: 'unreadable', payloadRedacted: {}, signatureValid: true, orderId: null, provider: gateway });
      return { status: 'OK', ...(created ? {} : { duplicate: true }), result: 'IGNORED' };
    }
    const known = ev.providerOrderId ? await this.repo.findOrderByProviderId(ev.providerOrderId) : null;
    const { created, row } = await this.repo.insertEvent({ providerEventId: ev.eventId, type: ev.type, payloadRedacted: ev.redacted, signatureValid: true, orderId: known?.id ?? null, provider: gateway });
    if (!created && row.processedAt) return { status: 'OK', duplicate: true, result: row.result ?? 'DUPLICATE' };   // seen and finished: replay-safe, still a 200

    let result = 'IGNORED';
    if (ev.kind === 'PAID') {
      if (!known) {
        result = 'NO_ORDER';
        // not a plan order: it may be a wallet top-up (Wave 3 Part J), settled by the same rules and the same checks as on the Razorpay route
        if (this.topups && ev.providerOrderId) { const r = await this.topups.handleCapturedPayment({ providerOrderId: ev.providerOrderId, paymentId: String(ev.paymentId ?? `order-${ev.providerOrderId}`), amount: ev.amountMinor as number, currency: String(ev.currency ?? ''), gateway }); if (r) result = r; }
      } else if ((isGatewayName(known.gateway) ? known.gateway : 'razorpay') !== gateway) result = 'GATEWAY_MISMATCH';   // money reported by a gateway the order was never started on
      else result = await this.settle({ orderId: known.id, paid: { paymentId: String(ev.paymentId ?? `order-${known.providerOrderId}`), amount: ev.amountMinor as number, currency: String(ev.currency ?? '') }, via: 'WEBHOOK', actor: SYSTEM, reason: null });
    } else if (ev.kind === 'FAILED' && known) {
      result = 'FAILED_ATTEMPT';   // a failed ATTEMPT does not end an order: it stays payable until it expires
    }
    await this.repo.finishEvent(ev.eventId, { processedAt: this.clock(), result, orderId: known?.id ?? null });
    return { status: 'OK', result };
  }

  /** Always resolves with a small answer the controller turns into 200 (duplicates included) or 401 (bad signature). */
  async handleWebhook(rawBody: Buffer | string | undefined, signature: string | undefined, eventIdHeader: string | undefined): Promise<{ status: 'OK' | 'BAD_SIGNATURE' | 'IGNORED'; duplicate?: boolean; result?: string }> {
    const port = await this.gate.webhookPort();
    if (!port) return { status: 'IGNORED' };   // payments are off or not set up: nothing to verify against, nothing to do
    const raw = rawBody ?? '';
    const digest = createHash('sha256').update(raw).digest('hex');
    if (!port.verifyWebhookSignature(raw, signature)) {
      await this.repo.insertEvent({ providerEventId: `bad-${digest.slice(0, 40)}`, type: 'unverified', payloadRedacted: {}, signatureValid: false, orderId: null }).catch(() => undefined);
      return { status: 'BAD_SIGNATURE' };
    }
    let body: unknown = null;
    try { body = JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw)); } catch { /* a signed but unreadable body: recorded and ignored */ }
    const eventId = (typeof eventIdHeader === 'string' && /^[A-Za-z0-9_-]{6,80}$/.test(eventIdHeader) ? eventIdHeader : `evt-${digest.slice(0, 40)}`);
    const red = redactPaymentPayload(body);
    const type = typeof (red as { event?: unknown }).event === 'string' ? String((red as { event: string }).event) : 'unknown';
    const pay = ((red as { payload?: { payment?: { entity?: Record<string, unknown> } } }).payload?.payment?.entity ?? {}) as { id?: string; order_id?: string; amount?: number; currency?: string };
    const ord = ((red as { payload?: { order?: { entity?: Record<string, unknown> } } }).payload?.order?.entity ?? {}) as { id?: string; amount_paid?: number; currency?: string };
    const providerOrderId = pay.order_id ?? ord.id ?? null;
    const known = providerOrderId ? await this.repo.findOrderByProviderId(providerOrderId) : null;

    const { created, row } = await this.repo.insertEvent({ providerEventId: eventId, type, payloadRedacted: red, signatureValid: true, orderId: known?.id ?? null });
    if (!created && row.processedAt) return { status: 'OK', duplicate: true, result: row.result ?? 'DUPLICATE' };   // seen and finished: replay-safe, still a 200

    let result = 'IGNORED';
    if ((type === 'payment.captured' || type === 'order.paid') && known) {
      const amount = typeof pay.amount === 'number' ? pay.amount : ord.amount_paid;
      const out = await this.settle({ orderId: known.id, paid: { paymentId: String(pay.id ?? `order-${known.providerOrderId}`), amount: amount as number, currency: String(pay.currency ?? ord.currency ?? '') }, via: 'WEBHOOK', actor: SYSTEM, reason: null });
      result = out;
    } else if ((type === 'payment.captured' || type === 'order.paid') && !known) {
      result = 'NO_ORDER';
      if (this.topups && providerOrderId) {   // not a plan order: it may be a wallet top-up (Batch 4). Plan orders above are untouched.
        const amount = typeof pay.amount === 'number' ? pay.amount : ord.amount_paid;
        const r = await this.topups.handleCapturedPayment({ providerOrderId, paymentId: String(pay.id ?? `order-${providerOrderId}`), amount: amount as number, currency: String(pay.currency ?? ord.currency ?? '') });
        if (r) result = r;
      }
    }
    await this.repo.finishEvent(eventId, { processedAt: this.clock(), result, orderId: known?.id ?? null });
    return { status: 'OK', result };
  }

  // ───────────────────────────────────────────────────────────────────────────────────────── staff
  private async load(orderId: string): Promise<OrderRow> {
    const o = await this.repo.getOrder(orderId);
    if (!o) throw new NotFoundException(billingError('ORDER_NOT_FOUND', ORDER_NOT_FOUND_MESSAGE));
    return o;
  }

  /**
   * Wave 3 Part E: cash confirmed by an ADMIN or SUPER_ADMIN, for a CASH order an admin made (the vendor can never pay by hand). Every detail is required (see checkCashConfirmation): the method CASH, the receipt
   * reference, the day received, the amount (exactly the order total including GST) and a special-case note. Then, in ONE transaction: the order is marked paid, the plan is activated, the invoice is made and
   * the audit row is written (SettlementService.settle). Confirming twice changes nothing. Returns the invoice number and the cash reference, so the screen can show the reference.
   * Who may call it is the role matrix (ADMIN and SUPER_ADMIN); this method refuses everything that is not cash on a cash order, whoever calls it.
   */
  async confirmCash(orderId: string, input: CashInput, actor: Actor, byName: string): Promise<{ status: OrderStatus; outcome: SettleOutcome; invoice: { number: string; reference: string | null } | null }> {
    const o = await this.load(orderId);
    const c = checkCashConfirmation(input, o.amountPaise, this.clock().toISOString().slice(0, 10));
    if (!c.ok) {
      if (c.code === 'OFFLINE_AMOUNT_MISMATCH') throw adminGapError(409, 'OFFLINE_AMOUNT_MISMATCH', 'The amount received is not the amount of the order, so it cannot be marked paid.');
      throw new BadRequestException({ ...billingError(c.code, c.code === 'CASH_ONLY' ? 'Only cash can be confirmed here. A plan is otherwise paid through the payment gateway.' : 'Some details need fixing.'), details: { fields: c.fields } });
    }
    if (o.gateway !== 'cash') throw new ConflictException(billingError('CASH_ORDER_INVALID', 'Cash can only be confirmed on a cash order made by an admin.'));
    if (o.status === 'PAID') { const inv = await this.repo.getInvoiceByOrder(o.id); return { status: 'PAID', outcome: 'ALREADY_PAID', invoice: inv ? { number: inv.invoiceNumber, reference: this.cashRef(inv.snapshot) } : null }; }
    if (o.status !== 'PENDING_PAYMENT') throw new ConflictException(billingError('ORDER_STATE_INVALID', 'Only an order that is waiting for payment can be confirmed as paid in cash.'));
    const ctx: SettleCtx = { planLevel: null };
    const outcome = await this.settle({ orderId, paid: { paymentId: `cash:${o.id}`, amount: o.amountPaise, currency: o.currency }, via: 'STAFF', actor, reason: c.value.note, offline: { reference: c.value.reference, receivedOn: new Date(`${c.value.receivedOn}T00:00:00.000Z`), amountPaise: c.value.amountPaise, byName } }, ctx);
    return { status: (await this.load(orderId)).status, outcome, invoice: ctx.invoice ? { number: ctx.invoice.number, reference: c.value.reference } : null };
  }
  private cashRef(snapshot: Record<string, unknown>): string | null { const p = snapshot.payment as { reference?: unknown } | undefined; return typeof p?.reference === 'string' ? p.reference : null; }

  /** INTERNAL: no route calls this any more (Wave 3 Part E: staff confirm CASH through confirmCash, and nothing else marks an order paid by hand). Kept for the services and tests that settle an order directly. SUPER_ADMIN: an offline payment (bank transfer, cash). The same settlement path as an online payment; the subscription source is STAFF; a reason is required and audited. */
  async markPaid(orderId: string, reason: string, actor: Actor, offline?: OfflineSettle): Promise<{ status: OrderStatus; outcome: SettleOutcome }> {
    if (typeof reason !== 'string' || reason.trim().length < 3) throw new BadRequestException('A reason of at least 3 characters is required.');
    const o = await this.load(orderId);
    if (o.status === 'PAID') return { status: 'PAID', outcome: 'ALREADY_PAID' };
    if (o.status !== 'PENDING_PAYMENT' && o.status !== 'REVIEW') throw new ConflictException(billingError('ORDER_STATE_INVALID', 'Only an order that is waiting for payment, or under review, can be marked paid.'));
    // C6: the money that arrived is never more or less than the order. A different amount is not a payment of this order, so it is refused: staff correct the number, or settle it another way.
    if (offline && offline.amountPaise !== null && offline.amountPaise !== o.amountPaise) throw adminGapError(409, 'OFFLINE_AMOUNT_MISMATCH', 'The amount received is not the amount of the order, so it cannot be marked paid.');
    const outcome = await this.settle({ orderId, paid: { paymentId: `offline:${o.id}`, amount: o.amountPaise, currency: o.currency }, via: 'STAFF', actor, reason: reason.trim(), ...(offline ? { offline } : {}) });
    return { status: (await this.load(orderId)).status, outcome };
  }

  /** SUPER_ADMIN: record that money was given back. A RECORD only: no provider call is made, and nothing about the subscription changes. */
  async recordRefund(orderId: string, input: { amountPaise: number; note: string }, actor: Actor): Promise<{ refundRecordedPaise: number }> {
    if (typeof input.note !== 'string' || input.note.trim().length < 3) throw new BadRequestException('A note of at least 3 characters is required.');
    const o = await this.load(orderId);
    if (o.status !== 'PAID' || o.paidAmountPaise === null) throw new ConflictException(billingError('ORDER_STATE_INVALID', 'Only a paid order can have a refund recorded.'));
    if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0 || input.amountPaise > o.paidAmountPaise) throw new BadRequestException('The refund must be a whole number of paise, more than 0 and not more than was paid.');
    const total = (o.refundRecordedPaise ?? 0) + input.amountPaise;
    if (total > o.paidAmountPaise) throw new BadRequestException('Refunds recorded so far plus this one would be more than was paid.');
    const now = this.clock();
    const ok = await this.repo.updateOrderCas(o.id, ['PAID'], { refundRecordedPaise: total, refundNote: input.note.trim().slice(0, 300), refundRecordedBy: actor.id, refundRecordedAt: now });
    if (!ok) throw new ConflictException(billingError('ORDER_STATE_INVALID', 'The order changed; please try again.'));
    await this.repo.transaction(o.vendorId, (tx) => tx.audit(actor, 'billing.order.refund_recorded', o.id, { refundRecordedPaise: o.refundRecordedPaise }, { refundRecordedPaise: total, note: input.note.trim().slice(0, 300) }));
    // a refund of the WHOLE payment is a reversed payment: the commission line of that vendor is marked REVERSED and flagged for the owner (a part refund is not a reversal)
    if (total === o.paidAmountPaise && this.paidHook) void this.paidHook.onPaymentReversed({ vendorId: o.vendorId, orderId: o.id, reason: 'refund recorded' }).catch(() => undefined);
    return { refundRecordedPaise: total };
  }

  /** Orders nobody paid in time stop being payable. Called by the reminder tick; safe to call any time. */
  async expireStale(): Promise<number> { return this.repo.expireStale(this.clock()); }
}
