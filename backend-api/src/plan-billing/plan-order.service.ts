import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Actor } from '../plans/admin/audit.service';
import { effectiveStatus } from '../plans/entitlements/entitlement-engine';
import { priceQuote, resolveApplicableDiscounts, selectTaxRate } from '../plans/pricing/price-quote';
import { classifyChange, upgradeCreditPaise } from './core/amounts';
import { OrderStatus } from './core/order-state';
import { billingError, ORDER_NOT_FOUND_MESSAGE } from './plan-billing.errors';
import { DuplicateOrderError, OrderRow, PlanBillingRepository } from './plan-billing.repository';
import { PaymentsGate } from './razorpay/payments-gate';
import { BillingSettingsService } from './settings/billing-settings.service';
import { PaymentSettlementService } from './settlement.service';

const TERMS = [3, 6, 12];
const notFound = (): NotFoundException => new NotFoundException(billingError('ORDER_NOT_FOUND', ORDER_NOT_FOUND_MESSAGE));

export interface OrderView {
  id: string; status: OrderStatus; kind: string; planKey: string | null; termMonths: number; amountPaise: number; currency: string; quote: Record<string, unknown>;
  providerOrderId: string | null; keyId: string | null; expiresAt: Date; paidAt: Date | null; createdAt: Date;
}

/**
 * Buying or renewing a plan (slice 5.1b): the quote, the provider order, and the owner's confirmation. Nothing here ever activates a plan: only the settlement (a verified provider
 * payment, or staff marking an offline payment) does. The price, tax and discounts all come from the plan tables (never from the request); the amount is integer paise.
 */
@Injectable()
export class PlanOrderService {
  clock: () => Date = () => new Date();
  constructor(
    private readonly repo: PlanBillingRepository, @Inject(BillingSettingsService) private readonly settings: Pick<BillingSettingsService, 'get'>, @Inject(PaymentsGate) private readonly gate: Pick<PaymentsGate, 'port'>,
    private readonly settlement: PaymentSettlementService,
  ) {}

  view(o: OrderRow, keyId: string | null = null): OrderView {
    const q = o.quote as { planKey?: string; base?: unknown; discounts?: unknown; creditPaise?: unknown; taxMinor?: unknown; totalMinor?: unknown; taxRatePercent?: unknown; taxName?: unknown; taxInclusive?: unknown };
    return {
      id: o.id, status: o.status, kind: o.kind, planKey: q.planKey ?? null, termMonths: o.termMonths, amountPaise: o.amountPaise, currency: o.currency,
      quote: { base: q.base ?? null, discounts: q.discounts ?? [], creditPaise: q.creditPaise ?? 0, taxName: q.taxName ?? null, taxRatePercent: q.taxRatePercent ?? null, taxInclusive: q.taxInclusive ?? false, taxMinor: q.taxMinor ?? 0, totalMinor: q.totalMinor ?? o.amountPaise },
      providerOrderId: o.providerOrderId, keyId, expiresAt: o.expiresAt, paidAt: o.paidAt, createdAt: o.createdAt,
    };
  }

  async create(vendorId: string, input: { planKey: string; termMonths: number; idempotencyKey: string; promoCode?: string }, actor: Actor): Promise<OrderView> {
    const now = this.clock();
    const key = String(input.idempotencyKey ?? '');
    const prior = await this.repo.findOrderByIdempotency(vendorId, key);
    if (prior) return this.replay(prior, input);

    const s = await this.settings.get();
    const port = await this.gate.port();   // refuses first when payments are off or not set up: no order row is created for nothing
    if (!TERMS.includes(input.termMonths)) throw new BadRequestException(billingError('TERM_NOT_OFFERED', 'Choose a term of 3, 6 or 12 months.'));
    const plan = await this.repo.getPlanByKey(String(input.planKey ?? ''));
    if (!plan || plan.status !== 'ACTIVE' || !plan.isPublic || plan.level !== 'PRO') throw new ConflictException(billingError('PLAN_NOT_PURCHASABLE', 'That plan cannot be bought.'));
    const sub = await this.repo.currentSub(vendorId);
    if (!sub || sub.track !== plan.track) throw new ConflictException(billingError('PLAN_NOT_PURCHASABLE', 'That plan cannot be bought.'));
    const price = await this.repo.activePrice(plan.id, input.termMonths, now);
    if (!price) throw new ConflictException(billingError('PRICE_NOT_AVAILABLE', 'That plan and term has no approved price right now.'));
    const tax = selectTaxRate(await this.repo.taxRates(), now);
    if (!tax) throw new ConflictException(billingError('PRICE_NOT_AVAILABLE', 'The tax rate is not set up yet, so this cannot be priced.'));

    const curStatus = effectiveStatus({ status: sub.status as never, endsAt: sub.endsAt, graceEndsAt: sub.graceEndsAt }, now, { graceDays: s.graceDays });
    const curMonthly = sub.amountPaise !== null && sub.termMonths ? Math.floor(sub.amountPaise / sub.termMonths) : 0;
    const kind = classifyChange({ planKey: sub.planKey, level: sub.level, monthlyPaise: curMonthly, endsAt: sub.endsAt, status: curStatus as never }, { planKey: plan.key, level: plan.level, monthlyPaise: Math.floor(price.amountPaise / input.termMonths) }, now);
    if (kind === 'DOWNGRADE') throw new ConflictException(billingError('PLAN_CHANGE_NOT_ALLOWED', 'A cheaper plan can be chosen when your current term ends.'));
    const credit = kind === 'UPGRADE' ? upgradeCreditPaise(s.upgradeProration, { amountPaise: sub.amountPaise, termMonths: sub.termMonths ?? 0, endsAt: sub.endsAt }, now) : 0;

    const rules = resolveApplicableDiscounts(await this.repo.discountRules(), { now, termMonths: input.termMonths, planKey: plan.key, code: input.promoCode });
    const quote = priceQuote({ basePaise: Math.max(0, price.amountPaise - credit), taxInclusive: price.taxInclusive, discounts: rules.applicable, taxRatePercent: tax.ratePercent });
    if (!Number.isInteger(quote.totalMinor) || quote.totalMinor < 100) throw new ConflictException(billingError('ORDER_NOT_PAYABLE', 'This amount cannot be paid online. Please contact support.'));

    let order: OrderRow;
    try {
      order = await this.repo.createOrder({
        vendorId, planId: plan.id, termMonths: input.termMonths, kind: kind === 'RENEWAL' ? 'RENEWAL' : kind === 'UPGRADE' ? 'UPGRADE' : 'NEW',
        quote: { ...quote, base: price.amountPaise, planKey: plan.key, priceId: price.id, creditPaise: credit, taxName: tax.name, taxRatePercent: tax.ratePercent, termMonths: input.termMonths },
        amountPaise: quote.totalMinor, currency: price.currency, idempotencyKey: key, expiresAt: new Date(now.getTime() + s.orderExpiryMinutes * 60_000), createdByType: actor.type, createdById: actor.id,
      });
    } catch (e) {
      if (e instanceof DuplicateOrderError) { const again = await this.repo.findOrderByIdempotency(vendorId, key); if (again) return this.replay(again, input); }
      throw e;
    }
    try {
      const po = await port.createOrder({ amountPaise: order.amountPaise, currency: order.currency, receipt: order.id });
      await this.repo.updateOrderCas(order.id, ['CREATED'], { status: 'PENDING_PAYMENT', providerOrderId: po.id });
    } catch {
      await this.repo.updateOrderCas(order.id, ['CREATED'], { status: 'FAILED' });
      throw new ConflictException(billingError('PAYMENT_PROVIDER_ERROR', 'The payment service could not start this order. Please try again.'));
    }
    return this.view((await this.repo.getOrder(order.id))!, port.publicKeyId());
  }

  private async replay(prior: OrderRow, input: { planKey: string; termMonths: number }): Promise<OrderView> {
    const plan = await this.repo.getPlanById(prior.planId);
    if (!plan || plan.key !== input.planKey || prior.termMonths !== input.termMonths) throw new ConflictException(billingError('IDEMPOTENCY_CONFLICT', 'That request key was already used for a different order.'));
    let keyId: string | null = null;
    try { keyId = (await this.gate.port()).publicKeyId(); } catch { /* payments switched off since: the order is still shown */ }
    return this.view(prior, keyId);
  }

  private async own(vendorId: string, id: string): Promise<OrderRow> {
    const o = typeof id === 'string' && id ? await this.repo.getOrder(id) : null;
    if (!o || o.vendorId !== vendorId) throw notFound();
    return o;
  }

  /** The browser says "I paid"; we do not believe it. The signature is checked, then the PROVIDER is asked what that payment really is. */
  async confirm(vendorId: string, orderId: string, input: { paymentId: string; signature: string }, actor: Actor): Promise<OrderView & { pending?: true }> {
    const o = await this.own(vendorId, orderId);
    const port = await this.gate.port();
    if (o.status === 'PAID') return this.view(o, port.publicKeyId());
    if (o.status !== 'PENDING_PAYMENT' || !o.providerOrderId) throw new ConflictException(billingError('ORDER_STATE_INVALID', 'This order cannot be confirmed now.'));
    if (!port.verifyPaymentSignature({ orderId: o.providerOrderId, paymentId: String(input.paymentId ?? ''), signature: String(input.signature ?? '') })) {
      throw new BadRequestException(billingError('PAYMENT_SIGNATURE_INVALID', 'The payment could not be verified.'));
    }
    let payment;
    try { payment = await port.fetchPayment(input.paymentId); } catch { throw new ConflictException(billingError('PAYMENT_PROVIDER_ERROR', 'The payment service could not be reached. Please try again.')); }
    if (payment.orderId !== o.providerOrderId) throw new BadRequestException(billingError('PAYMENT_SIGNATURE_INVALID', 'The payment could not be verified.'));
    if (payment.status === 'authorized' || payment.status === 'created') return { ...this.view(o, port.publicKeyId()), pending: true };
    if (payment.status !== 'captured') throw new ConflictException(billingError('PAYMENT_NOT_CAPTURED', 'The payment was not completed.'));
    await this.settlement.settle({ orderId: o.id, paid: { paymentId: payment.id, amount: payment.amount, currency: payment.currency }, via: 'CONFIRM', actor, reason: null });
    return this.view((await this.repo.getOrder(o.id))!, port.publicKeyId());
  }

  async listMine(vendorId: string, page: number, pageSize: number) {
    const { items, total } = await this.repo.listOrdersForVendor(vendorId, (page - 1) * pageSize, pageSize);
    return { items: items.map((o) => this.view(o)), total };
  }
  async invoicesMine(vendorId: string, page: number, pageSize: number) {
    const { items, total } = await this.repo.listInvoicesForVendor(vendorId, (page - 1) * pageSize, pageSize);
    return { items: items.map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, financialYear: i.financialYear, issuedAt: i.issuedAt, orderId: i.orderId, snapshot: i.snapshot, taxBreakdown: i.taxBreakdown })), total };
  }
}
