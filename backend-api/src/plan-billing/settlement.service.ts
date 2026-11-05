import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ActivityBus } from '../common/activity-bus';
import { createHash } from 'crypto';
import { Actor } from '../plans/admin/audit.service';
import { EntitlementsService } from '../plans/entitlements/entitlements.service';
import { financialYearOf, formatInvoiceNumber, renewalEnd, verifyPaidAmount } from './core/amounts';
import { canTransitionOrder, OrderStatus } from './core/order-state';
import { redactPaymentPayload } from './core/redact';
import { billingError, ORDER_NOT_FOUND_MESSAGE } from './plan-billing.errors';
import { OrderRow, PlanBillingRepository } from './plan-billing.repository';
import { PaymentsGate } from './razorpay/payments-gate';
import { BillingSettingsService } from './settings/billing-settings.service';
import { TopupSettlementHook } from './topup-hook';

export type SettleOutcome = 'PAID' | 'ALREADY_PAID' | 'REVIEW' | 'IGNORED' | 'NO_ORDER';
export interface SettleInput { orderId: string; paid: { paymentId: string; amount: number; currency: string }; via: 'CONFIRM' | 'WEBHOOK' | 'STAFF'; actor: Actor; reason: string | null }
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
    private readonly repo: PlanBillingRepository, @Inject(BillingSettingsService) private readonly settings: Pick<BillingSettingsService, 'get'>, @Inject(PaymentsGate) private readonly gate: Pick<PaymentsGate, 'webhookPort'>,
    @Inject(EntitlementsService) private readonly entitlements: Pick<EntitlementsService, 'invalidate'>,
    /** Batch 4: the wallet's top-ups are paid through the same webhook; asked only when the provider order is not a plan order. Absent = plan payments only (nothing changes). */
    @Optional() @Inject(TopupSettlementHook) private readonly topups?: TopupSettlementHook,
    /** Batch 4: says "a plan order was paid" after the work is committed (the wallet opens on it). Absent = nobody is told. */
    @Optional() @Inject(ActivityBus) private readonly bus?: Pick<ActivityBus, 'emit'>,
  ) {}

  async settle(i: SettleInput): Promise<SettleOutcome> {
    const order = await this.repo.getOrder(i.orderId);
    if (!order) return 'NO_ORDER';
    const s = await this.settings.get();
    let paidPlanLevel: string | null = null;
    const outcome = await this.repo.transaction(order.vendorId, async (tx) => {
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
      const fy = financialYearOf(now);
      const n = await tx.nextInvoiceNumber(fy);
      const q = o.quote as { discounts?: unknown; base?: number; taxMinor?: number; taxableMinor?: number; taxName?: string; taxRatePercent?: number; taxInclusive?: boolean; creditPaise?: number };
      const invoice = await tx.insertInvoice({
        vendorId: o.vendorId, orderId: o.id, invoiceNumber: formatInvoiceNumber(s.invoiceNumberPrefix, fy, n), financialYear: fy, issuedAt: now,
        snapshot: {
          seller: { name: s.invoiceSellerName, address: s.invoiceSellerAddress, gstin: s.invoiceSellerGstin, complete: !!(s.invoiceSellerName && s.invoiceSellerAddress) },
          buyer: { businessName: vendor.businessName, name: vendor.name, email: vendor.email, phone: vendor.phone },
          plan: { key: plan.key, name: plan.name }, termMonths: o.termMonths, period: { from: now.toISOString(), to: endsAt.toISOString() },
          order: { id: o.id, providerOrderId: o.providerOrderId, paymentId: i.paid.paymentId, via: i.via }, amountPaise: o.amountPaise, currency: o.currency, kind: o.kind,
        },
        taxBreakdown: { name: q.taxName ?? null, ratePercent: q.taxRatePercent ?? null, taxInclusive: q.taxInclusive ?? false, taxableMinor: q.taxableMinor ?? null, taxMinor: q.taxMinor ?? 0, creditPaise: q.creditPaise ?? 0, discounts: q.discounts ?? [] },
      });
      const ok = await tx.updateOrderCas(o.id, [o.status], { status: 'PAID', paymentId: i.paid.paymentId, paidAmountPaise: i.paid.amount, paidAt: now, source: i.via === 'STAFF' ? 'STAFF' : 'SELF', reason: i.reason, subscriptionId: sub.id });
      if (!ok) throw new Error('the order changed during settlement');   // rolls the whole transaction back
      await tx.audit(i.actor, 'billing.order.paid', o.id, { status: o.status }, { status: 'PAID', subscriptionId: sub.id, invoice: invoice.invoiceNumber, via: i.via, amountPaise: o.amountPaise });
      paidPlanLevel = plan.level;
      return 'PAID' as const;
    });
    if (outcome === 'PAID') {
      this.entitlements.invalidate(order.vendorId);
      void this.bus?.emit({ type: 'plan.order.paid', vendorId: order.vendorId, at: this.clock(), actor: { type: i.actor.type, id: i.actor.id }, data: { orderId: order.id, planLevel: paidPlanLevel, via: i.via } });
    }
    return outcome;
  }

  // ───────────────────────────────────────────────────────────────────────────────────────── webhook
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

  /** SUPER_ADMIN: an offline payment (bank transfer, cash). The same settlement path as an online payment; the subscription source is STAFF; a reason is required and audited. */
  async markPaid(orderId: string, reason: string, actor: Actor): Promise<{ status: OrderStatus; outcome: SettleOutcome }> {
    if (typeof reason !== 'string' || reason.trim().length < 3) throw new BadRequestException('A reason of at least 3 characters is required.');
    const o = await this.load(orderId);
    if (o.status === 'PAID') return { status: 'PAID', outcome: 'ALREADY_PAID' };
    if (o.status !== 'PENDING_PAYMENT' && o.status !== 'REVIEW') throw new ConflictException(billingError('ORDER_STATE_INVALID', 'Only an order that is waiting for payment, or under review, can be marked paid.'));
    const outcome = await this.settle({ orderId, paid: { paymentId: `offline:${o.id}`, amount: o.amountPaise, currency: o.currency }, via: 'STAFF', actor, reason: reason.trim() });
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
    return { refundRecordedPaise: total };
  }

  /** Orders nobody paid in time stop being payable. Called by the reminder tick; safe to call any time. */
  async expireStale(): Promise<number> { return this.repo.expireStale(this.clock()); }
}
