import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Actor } from '../plans/admin/audit.service';
import { renderInvoiceHtml } from '../v3-vendor-gaps/core/gaps-core';
import { gapError } from '../v3-vendor-gaps/vendor-gaps.errors';
import { effectiveStatus } from '../plans/entitlements/entitlement-engine';
import { priceQuote, selectTaxRate } from '../plans/pricing/price-quote';
import { classifyChange, upgradeCreditPaise } from './core/amounts';
import { OrderStatus } from './core/order-state';
import { billingError, ORDER_NOT_FOUND_MESSAGE } from './plan-billing.errors';
import { DuplicateOrderError, OrderRow, PlanBillingRepository } from './plan-billing.repository';
import { GatewayName, isGatewayName } from './gateway/gateway-core';
import { PaymentGatewayPort } from './gateway/gateway.port';
import { RazorpayGateway } from './gateway/razorpay.gateway';
import { PaymentsGate } from './razorpay/payments-gate';
import { BillingSettings } from './settings/billing-settings';
import { BillingSettingsService } from './settings/billing-settings.service';
import { PaymentSettlementService } from './settlement.service';

const TERMS = [3, 6, 12];
/** how long a cash order waits for an admin to confirm the cash */
export const CASH_ORDER_DAYS = 14;
const notFound = (): NotFoundException => new NotFoundException(billingError('ORDER_NOT_FOUND', ORDER_NOT_FOUND_MESSAGE));

export interface OrderView {
  id: string; status: OrderStatus; kind: string; planKey: string | null; termMonths: number; amountPaise: number; currency: string; quote: Record<string, unknown>;
  providerOrderId: string | null; keyId: string | null; expiresAt: Date; paidAt: Date | null; createdAt: Date;
  /** Wave 3 Part C: which gateway the order is on, and the session token the browser checkout needs (Cashfree); null for Razorpay, whose checkout uses keyId and providerOrderId */
  gateway: GatewayName | 'cash'; clientToken: string | null;
}

/**
 * Buying or renewing a plan (slice 5.1b): the quote, the provider order, and the owner's confirmation. Nothing here ever activates a plan: only the settlement (a verified provider
 * payment, or staff marking an offline payment) does. The price, tax and discounts all come from the plan tables (never from the request); the amount is integer paise.
 */
@Injectable()
export class PlanOrderService {
  clock: () => Date = () => new Date();
  constructor(
    private readonly repo: PlanBillingRepository, @Inject(BillingSettingsService) private readonly settings: Pick<BillingSettingsService, 'get'>, @Inject(PaymentsGate) private readonly gate: Pick<PaymentsGate, 'port'> & Partial<Pick<PaymentsGate, 'gatewayPort' | 'portFor'>>,
    private readonly settlement: PaymentSettlementService,
  ) {}

  view(o: OrderRow, keyId: string | null = null): OrderView {
    const q = o.quote as { planKey?: string; base?: unknown; discounts?: unknown; creditPaise?: unknown; taxMinor?: unknown; totalMinor?: unknown; taxRatePercent?: unknown; taxName?: unknown; taxInclusive?: unknown };
    return {
      id: o.id, status: o.status, kind: o.kind, planKey: q.planKey ?? null, termMonths: o.termMonths, amountPaise: o.amountPaise, currency: o.currency,
      quote: { base: q.base ?? null, discounts: q.discounts ?? [], creditPaise: q.creditPaise ?? 0, taxName: q.taxName ?? null, taxRatePercent: q.taxRatePercent ?? null, taxInclusive: q.taxInclusive ?? false, taxMinor: q.taxMinor ?? 0, totalMinor: q.totalMinor ?? o.amountPaise },
      providerOrderId: o.providerOrderId, keyId, expiresAt: o.expiresAt, paidAt: o.paidAt, createdAt: o.createdAt,
      gateway: isGatewayName(o.gateway) ? o.gateway : o.gateway === 'cash' ? 'cash' : 'razorpay', clientToken: o.gatewayClientToken ?? null,
    };
  }

  async create(vendorId: string, input: { planKey: string; termMonths: number; idempotencyKey: string }, actor: Actor): Promise<OrderView> {
    const now = this.clock();
    const key = String(input.idempotencyKey ?? '');
    const prior = await this.repo.findOrderByIdempotency(vendorId, key);
    if (prior) return this.replay(prior, input);

    const s = await this.settings.get();
    const port = await this.activePort();   // refuses first when payments are off or not set up: no order row is created for nothing
    const { plan, price, tax, kind, credit, quote } = await this.buildQuote(vendorId, input, now, s);

    let order: OrderRow;
    try {
      order = await this.repo.createOrder({
        vendorId, planId: plan.id, termMonths: input.termMonths, kind: kind === 'RENEWAL' ? 'RENEWAL' : kind === 'UPGRADE' ? 'UPGRADE' : 'NEW',
        quote: { ...quote, base: price.amountPaise, planKey: plan.key, priceId: price.id, creditPaise: credit, taxName: tax.name, taxRatePercent: tax.ratePercent, termMonths: input.termMonths },
        amountPaise: quote.totalMinor, currency: price.currency, gateway: port.gateway, idempotencyKey: key, expiresAt: new Date(now.getTime() + s.orderExpiryMinutes * 60_000), createdByType: actor.type, createdById: actor.id,
      });
    } catch (e) {
      if (e instanceof DuplicateOrderError) { const again = await this.repo.findOrderByIdempotency(vendorId, key); if (again) return this.replay(again, input); }
      throw e;
    }
    try {
      const po = await port.createOrder({ amountMinor: order.amountPaise, currency: order.currency, receipt: order.id, customer: await this.customerOf(vendorId) });
      await this.repo.updateOrderCas(order.id, ['CREATED'], { status: 'PENDING_PAYMENT', providerOrderId: po.providerOrderId, gatewayClientToken: po.clientToken });
    } catch {
      await this.repo.updateOrderCas(order.id, ['CREATED'], { status: 'FAILED' });
      throw new ConflictException(billingError('PAYMENT_PROVIDER_ERROR', 'The payment service could not start this order. Please try again.'));
    }
    return this.view((await this.repo.getOrder(order.id))!, port.publicKeyId());
  }

  /**
   * The price of a plan purchase, from the plan tables only (never from the request): the plan and the term must be sellable, the current plan decides NEW, RENEWAL or UPGRADE (a
   * downgrade is refused), the upgrade credit and discounts apply, the tax comes from the tax rates. Shared by the online order (create) and plan renewal from the wallet, so both
   * charge exactly the same amount. Throws the same coded errors in the same order as before this was extracted.
   */
  async buildQuote(vendorId: string, input: { planKey: string; termMonths: number }, now: Date, s: BillingSettings, opts: { withTax?: boolean } = {}) {
    const withTax = opts.withTax !== false;   // false = a wallet deduction: exactly the plan price, GST was already added at the refill (owner, 6 November 2026)
    if (!TERMS.includes(input.termMonths)) throw new BadRequestException(billingError('TERM_NOT_OFFERED', 'Choose a term of 3, 6 or 12 months.'));
    const plan = await this.repo.getPlanByKey(String(input.planKey ?? ''));
    if (!plan || plan.status !== 'ACTIVE' || !plan.isPublic || plan.level !== 'PRO') throw new ConflictException(billingError('PLAN_NOT_PURCHASABLE', 'That plan cannot be bought.'));
    const sub = await this.repo.currentSub(vendorId);
    if (!sub || sub.track !== plan.track) throw new ConflictException(billingError('PLAN_NOT_PURCHASABLE', 'That plan cannot be bought.'));
    const price = await this.repo.activePrice(plan.id, input.termMonths, now);
    if (!price) throw new ConflictException(billingError('PRICE_NOT_AVAILABLE', 'That plan and term has no approved price right now.'));
    const found = withTax ? selectTaxRate(await this.repo.taxRates(), now) : null;
    if (withTax && !found) throw new ConflictException(billingError('PRICE_NOT_AVAILABLE', 'The tax rate is not set up yet, so this cannot be priced.'));
    const tax = found ?? { name: 'NONE', ratePercent: 0 } as NonNullable<typeof found>;

    const curStatus = effectiveStatus({ status: sub.status as never, endsAt: sub.endsAt, graceEndsAt: sub.graceEndsAt }, now, { graceDays: s.graceDays });
    const curMonthly = sub.amountPaise !== null && sub.termMonths ? Math.floor(sub.amountPaise / sub.termMonths) : 0;
    const kind = classifyChange({ planKey: sub.planKey, level: sub.level, monthlyPaise: curMonthly, endsAt: sub.endsAt, status: curStatus as never }, { planKey: plan.key, level: plan.level, monthlyPaise: Math.floor(price.amountPaise / input.termMonths) }, now);
    if (kind === 'DOWNGRADE') throw new ConflictException(billingError('PLAN_CHANGE_NOT_ALLOWED', 'A cheaper plan can be chosen when your current term ends.'));
    const credit = kind === 'UPGRADE' ? upgradeCreditPaise(s.upgradeProration, { amountPaise: sub.amountPaise, termMonths: sub.termMonths ?? 0, endsAt: sub.endsAt }, now) : 0;

    // Version 3 has NO discount, coupon or offer (owner, 17 November 2026): the amount is the price book total (less the unused-term credit of an upgrade) plus GST on top, and nothing else. The discount rule tables are not read here.
    const quote = priceQuote({ basePaise: Math.max(0, price.amountPaise - credit), taxInclusive: withTax ? price.taxInclusive : false, discounts: [], taxRatePercent: withTax ? tax.ratePercent : 0 });
    if (!Number.isInteger(quote.totalMinor) || quote.totalMinor < 100) throw new ConflictException(billingError('ORDER_NOT_PAYABLE', 'This amount cannot be paid online. Please contact support.'));

    return { plan, sub, price, tax, kind, credit, quote };
  }

  private async replay(prior: OrderRow, input: { planKey: string; termMonths: number }): Promise<OrderView> {
    const plan = await this.repo.getPlanById(prior.planId);
    if (!plan || plan.key !== input.planKey || prior.termMonths !== input.termMonths) throw new ConflictException(billingError('IDEMPOTENCY_CONFLICT', 'That request key was already used for a different order.'));
    let keyId: string | null = null;
    try { keyId = (await this.portOf(prior)).publicKeyId(); } catch { /* payments switched off since: the order is still shown */ }
    return this.view(prior, keyId);
  }

  private async own(vendorId: string, id: string): Promise<OrderRow> {
    const o = typeof id === 'string' && id ? await this.repo.getOrder(id) : null;
    if (!o || o.vendorId !== vendorId) throw notFound();
    return o;
  }

  /**
   * Wave 3 Part E: an ADMIN or SUPER_ADMIN makes a CASH order for a vendor who paid cash in a special case. The amount is the same server price as an online order (price book plus GST, never typed),
   * the order has no gateway and no provider order, and it can only be settled by an admin confirming the cash (SettlementService.confirmCash). Idempotent by key.
   */
  async createCashOrder(vendorId: string, input: { planKey: string; termMonths: number; idempotencyKey: string }, actor: Actor): Promise<OrderView> {
    const now = this.clock();
    const key = String(input.idempotencyKey ?? '');
    const prior = await this.repo.findOrderByIdempotency(vendorId, key);
    if (prior) {
      const plan = await this.repo.getPlanById(prior.planId);
      if (!plan || plan.key !== input.planKey || prior.termMonths !== input.termMonths || prior.gateway !== 'cash') throw new ConflictException(billingError('IDEMPOTENCY_CONFLICT', 'That request key was already used for a different order.'));
      return this.view(prior);
    }
    const s = await this.settings.get();
    const { plan, price, tax, kind, credit, quote } = await this.buildQuote(vendorId, { planKey: input.planKey, termMonths: input.termMonths }, now, s);
    let order: OrderRow;
    try {
      order = await this.repo.createOrder({
        vendorId, planId: plan.id, termMonths: input.termMonths, kind: kind === 'RENEWAL' ? 'RENEWAL' : kind === 'UPGRADE' ? 'UPGRADE' : 'NEW',
        quote: { ...quote, base: price.amountPaise, planKey: plan.key, priceId: price.id, creditPaise: credit, taxName: tax.name, taxRatePercent: tax.ratePercent, termMonths: input.termMonths },
        amountPaise: quote.totalMinor, currency: price.currency, gateway: 'cash', idempotencyKey: key, expiresAt: new Date(now.getTime() + CASH_ORDER_DAYS * 86_400_000), createdByType: actor.type, createdById: actor.id,
      });
    } catch (e) {
      if (e instanceof DuplicateOrderError) { const again = await this.repo.findOrderByIdempotency(vendorId, key); if (again) return this.view(again); }
      throw e;
    }
    await this.repo.updateOrderCas(order.id, ['CREATED'], { status: 'PENDING_PAYMENT' });
    await this.repo.transaction(vendorId, (tx) => tx.audit(actor, 'billing.cash_order.created', order.id, null, { planKey: plan.key, termMonths: input.termMonths, amountPaise: order.amountPaise }));
    return this.view((await this.repo.getOrder(order.id))!);
  }

  // ───────────── the payment port (Wave 3 Part C) ─────────────
  /** The gateway checkout uses right now. A gate without the new methods (an older test double) is wrapped, so the order code speaks only to the port. */
  private async activePort(): Promise<PaymentGatewayPort> {
    return typeof this.gate.gatewayPort === 'function' ? this.gate.gatewayPort() : new RazorpayGateway(await this.gate.port());
  }
  /** The gateway an existing order was started on (a switch of the admin setting never moves an order that is already in flight). */
  private async portOf(o: OrderRow): Promise<PaymentGatewayPort> {
    const name: GatewayName = isGatewayName(o.gateway) ? o.gateway : 'razorpay';
    return typeof this.gate.portFor === 'function' ? this.gate.portFor(name) : new RazorpayGateway(await this.gate.port());
  }
  private async customerOf(vendorId: string): Promise<{ id: string; phone: string | null; email: string | null }> {
    let v: { phone: string | null; email: string | null } | null = null;
    try { v = (await this.repo.vendor(vendorId)) ?? null; } catch { v = null; }
    return { id: vendorId, phone: v?.phone ?? null, email: v?.email ?? null };
  }

  /**
   * The browser says "I paid"; we do not believe it. Where the gateway signs the return (Razorpay) the signature is checked, and then the GATEWAY is asked what the payments of this order really are.
   * Only a payment the gateway itself reports as successful, for exactly this order, is settled; the settlement checks the amount and the currency again and holds a mismatch for review.
   */
  async confirm(vendorId: string, orderId: string, input: { paymentId?: string; signature?: string }, actor: Actor): Promise<OrderView & { pending?: true }> {
    const o = await this.own(vendorId, orderId);
    const port = await this.portOf(o);
    if (o.status === 'PAID') return this.view(o, port.publicKeyId());
    if (o.status !== 'PENDING_PAYMENT' || !o.providerOrderId) throw new ConflictException(billingError('ORDER_STATE_INVALID', 'This order cannot be confirmed now.'));
    if (!port.verifyReturn({ providerOrderId: o.providerOrderId, paymentId: input.paymentId ?? null, signature: input.signature ?? null })) {
      throw new BadRequestException(billingError('PAYMENT_SIGNATURE_INVALID', 'The payment could not be verified.'));
    }
    let payments;
    try { payments = await port.fetchOrderPayments(o.providerOrderId, { paymentId: input.paymentId ?? null }); } catch { throw new ConflictException(billingError('PAYMENT_PROVIDER_ERROR', 'The payment service could not be reached. Please try again.')); }
    if (payments.some((p) => p.providerOrderId !== o.providerOrderId)) throw new BadRequestException(billingError('PAYMENT_SIGNATURE_INVALID', 'The payment could not be verified.'));
    const paid = payments.find((p) => p.status === 'SUCCESS');
    if (!paid) {
      // nothing successful yet: still in progress (or nothing attempted yet on a gateway that has no signed return), or it did not complete
      if (payments.some((p) => p.status === 'PENDING') || (payments.length === 0 && o.gateway === 'cashfree')) return { ...this.view(o, port.publicKeyId()), pending: true };
      throw new ConflictException(billingError('PAYMENT_NOT_CAPTURED', 'The payment was not completed.'));
    }
    await this.settlement.settle({ orderId: o.id, paid: { paymentId: paid.paymentId, amount: paid.amountMinor, currency: paid.currency }, via: 'CONFIRM', actor, reason: null });
    return this.view((await this.repo.getOrder(o.id))!, port.publicKeyId());
  }

  /** The owner gives up an order that has not been paid. A paid order, one under review and one already closed cannot be cancelled (a payment may be on its way for the last two). */
  async cancel(vendorId: string, orderId: string, actor: Actor): Promise<OrderView> {
    const o = await this.own(vendorId, orderId);
    if (o.status === 'CANCELLED') return this.view(o);
    if (o.status !== 'CREATED' && o.status !== 'PENDING_PAYMENT') throw new ConflictException(billingError('ORDER_STATE_INVALID', 'This order cannot be cancelled now.'));
    const ok = await this.repo.updateOrderCas(o.id, ['CREATED', 'PENDING_PAYMENT'], { status: 'CANCELLED' });
    if (!ok) throw new ConflictException(billingError('ORDER_STATE_INVALID', 'The order changed; please try again.'));
    await this.repo.transaction(vendorId, (tx) => tx.audit(actor, 'billing.order.cancelled', o.id, { status: o.status }, { status: 'CANCELLED' }));
    return this.view((await this.repo.getOrder(o.id))!);
  }

  async listMine(vendorId: string, page: number, pageSize: number) {
    const { items, total } = await this.repo.listOrdersForVendor(vendorId, (page - 1) * pageSize, pageSize);
    return { items: items.map((o) => this.view(o)), total };
  }
  async invoicesMine(vendorId: string, page: number, pageSize: number) {
    const { items, total } = await this.repo.listInvoicesForVendor(vendorId, (page - 1) * pageSize, pageSize);
    // totalPaise is the amount paid (the snapshot's amountPaise), added to the snapshot for the list screen; the stored snapshot is never changed
    return { items: items.map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, financialYear: i.financialYear, issuedAt: i.issuedAt, orderId: i.orderId, snapshot: { ...i.snapshot, ...(typeof i.snapshot.amountPaise === 'number' ? { totalPaise: i.snapshot.amountPaise } : {}) }, taxBreakdown: i.taxBreakdown })), total };
  }

  /** One of my plan invoices as a self-contained HTML page, from the stored snapshot only. Another vendor's invoice id answers like one that does not exist. */
  async invoicePage(vendorId: string, id: string): Promise<{ fileName: string; html: string }> {
    const inv = await this.repo.getInvoiceForVendor(vendorId, id);
    if (!inv) throw gapError(404, 'PLAN_INVOICE_NOT_FOUND', 'That invoice was not found.');
    return { fileName: `invoice-${inv.invoiceNumber.replace(/[^A-Za-z0-9._-]/g, '-')}.html`, html: renderInvoiceHtml(inv) };
  }
}
