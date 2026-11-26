import { ConflictException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { B3SettingsService } from '../../b3-settings/b3-settings.service';
import { KeyedQueue } from '../../common/keyed-queue';
import { Actor } from '../../plans/admin/audit.service';
import { billingError } from '../plan-billing.errors';
import { DuplicateOrderError, OrderRow, PlanBillingRepository } from '../plan-billing.repository';
import { PlanOrderService } from '../plan-order.service';
import { BillingSettingsService } from '../settings/billing-settings.service';
import { PaymentLinkGate } from './payment-link.gate';

export const isPayLinkOrder = (o: Pick<OrderRow, 'quote'>): boolean => (o.quote as { payLink?: unknown }).payLink === true;

export interface PayLinkView {
  orderId: string; status: OrderRow['status']; planKey: string | null; termMonths: number; amountPaise: number; currency: string; expiresAt: Date;
  /** null once the link can no longer be paid (paid, expired, cancelled, failed or held) */
  url: string | null;
  /** true: an open link for the same purchase was returned, nothing new was made */
  reused: boolean;
  /** always true in this build: the link takes test payments only */
  testMode: true;
}

/**
 * E11e: a shareable payment link for a Pro plan. The link is an ordinary plan order whose gateway object is a payment link, so a payment on it is settled by the
 * SAME code as the online checkout and the cash confirmation (PaymentSettlementService): the amount and currency are compared with the order, one invoice is
 * made, the plan starts, and the referral commission rule is the same. Nothing here activates a plan. The amount is the server price (price book plus GST).
 */
@Injectable()
export class PlanPayLinkService {
  clock: () => Date = () => new Date();
  private readonly logger = new Logger(PlanPayLinkService.name);
  /** one request at a time per business, so two clicks never make two payable links (one server process; the order's idempotency key guards a repeat everywhere) */
  private readonly queue = new KeyedQueue();

  constructor(
    private readonly repo: PlanBillingRepository,
    private readonly orders: PlanOrderService,
    private readonly gate: PaymentLinkGate,
    @Inject(BillingSettingsService) private readonly settings: Pick<BillingSettingsService, 'get'>,
    @Optional() @Inject(B3SettingsService) private readonly b3?: Pick<B3SettingsService, 'get'>,
  ) {}

  private view(o: OrderRow, reused: boolean): PayLinkView {
    const open = o.status === 'PENDING_PAYMENT' && o.expiresAt.getTime() > this.clock().getTime();
    return {
      orderId: o.id, status: o.status, planKey: (o.quote as { planKey?: string }).planKey ?? null, termMonths: o.termMonths, amountPaise: o.amountPaise, currency: o.currency, expiresAt: o.expiresAt,
      url: open ? (o.gatewayClientToken ?? null) : null, reused, testMode: true,
    };
  }

  create(vendorId: string, input: { planKey: string; termMonths: number; idempotencyKey: string }, actor: Actor): Promise<PayLinkView> {
    return this.queue.run(vendorId, () => this.createNow(vendorId, input, actor));
  }

  private async replay(prior: OrderRow, input: { planKey: string; termMonths: number }): Promise<PayLinkView> {
    const plan = await this.repo.getPlanById(prior.planId);
    if (!isPayLinkOrder(prior) || !plan || plan.key !== input.planKey || prior.termMonths !== input.termMonths) throw new ConflictException(billingError('IDEMPOTENCY_CONFLICT', 'That request key was already used for a different order.'));
    return this.view(prior, true);
  }

  private async createNow(vendorId: string, input: { planKey: string; termMonths: number; idempotencyKey: string }, actor: Actor): Promise<PayLinkView> {
    const now = this.clock();
    const key = String(input.idempotencyKey ?? '');
    const prior = await this.repo.findOrderByIdempotency(vendorId, key);
    if (prior) return this.replay(prior, input);

    // every refusal comes before any row is written
    const port = await this.gate.port();
    const hours = this.b3 ? (await this.b3.get()).payLinkExpiryHours : null;
    if (hours === null || hours === undefined) throw new ConflictException(billingError('PAYMENT_LINK_EXPIRY_NOT_SET', 'Payment links are not available yet. Our team must set how long a link stays open.'));
    const s = await this.settings.get();
    const { plan, price, tax, kind, credit, quote } = await this.orders.buildQuote(vendorId, input, now, s);

    // an open link for the same purchase at the same amount is handed out again; one at an old amount is closed (money paid on it afterwards is held for review)
    const open = (await this.repo.listOrdersForVendor(vendorId, 0, 100)).items.filter((o) => isPayLinkOrder(o) && o.status === 'PENDING_PAYMENT' && o.expiresAt.getTime() > now.getTime() && o.planId === plan.id && o.termMonths === input.termMonths);
    const same = open.find((o) => o.amountPaise === quote.totalMinor && o.currency === price.currency);
    if (same) return this.view(same, true);
    for (const old of open) {
      if (await this.repo.updateOrderCas(old.id, ['PENDING_PAYMENT'], { status: 'CANCELLED' })) await this.repo.transaction(vendorId, (tx) => tx.audit(actor, 'billing.pay_link.replaced', old.id, { amountPaise: old.amountPaise }, { amountPaise: quote.totalMinor }));
    }

    let order: OrderRow;
    try {
      order = await this.repo.createOrder({
        vendorId, planId: plan.id, termMonths: input.termMonths, kind: kind === 'RENEWAL' ? 'RENEWAL' : kind === 'UPGRADE' ? 'UPGRADE' : 'NEW',
        quote: { ...quote, base: price.amountPaise, planKey: plan.key, priceId: price.id, creditPaise: credit, taxName: tax.name, taxRatePercent: tax.ratePercent, termMonths: input.termMonths, payLink: true },
        amountPaise: quote.totalMinor, currency: price.currency, gateway: 'razorpay', idempotencyKey: key, expiresAt: new Date(now.getTime() + hours * 3_600_000), createdByType: actor.type, createdById: actor.id,
      });
    } catch (e) {
      if (e instanceof DuplicateOrderError) { const again = await this.repo.findOrderByIdempotency(vendorId, key); if (again) return this.replay(again, input); }
      throw e;
    }
    try {
      const v = await this.repo.vendor(vendorId);
      const link = await port.createLink({
        amountMinor: order.amountPaise, currency: order.currency, reference: order.id, description: `${plan.name}, ${input.termMonths} months`,
        customer: { name: v?.name || v?.businessName || 'Customer', phone: v?.phone ?? null, email: v?.email ?? null }, expiresAt: order.expiresAt,
      });
      // the link id is the order's gateway id: the webhook finds the order by it
      await this.repo.updateOrderCas(order.id, ['CREATED'], { status: 'PENDING_PAYMENT', providerOrderId: link.linkId, gatewayClientToken: link.url });
    } catch (e) {
      this.logger.warn(`payment link not made for order ${order.id} (${e instanceof Error ? e.name : 'error'})`);
      await this.repo.updateOrderCas(order.id, ['CREATED'], { status: 'FAILED' });
      throw new ConflictException(billingError('PAYMENT_PROVIDER_ERROR', 'The payment service could not make the link. Please try again.'));
    }
    await this.repo.transaction(vendorId, (tx) => tx.audit(actor, 'billing.pay_link.created', order.id, null, { planKey: plan.key, termMonths: input.termMonths, amountPaise: order.amountPaise }));
    return this.view((await this.repo.getOrder(order.id))!, false);
  }
}
