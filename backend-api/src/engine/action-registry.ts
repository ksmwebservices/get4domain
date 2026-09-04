import { Injectable, Logger } from '@nestjs/common';
import { RestaurantService } from '../restaurant/restaurant.service';
import { RetailService } from '../retail/retail.service';
import { RealEstateService } from '../realestate/realestate.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActionContext, ActionDefinition, ActionDescriptor } from './engine.types';
import {
  BillOrderActionInput, CreateSaleDto,
  CreateDealDto, CreateVisitDto, RealEstatePaymentInput,
} from './engine.dto';

/** Composite result of a public payment-CTA action. */
export interface PaymentCtaResult {
  dealId: string;
  /** Razorpay order (inert until captured), or null if the gateway is unconfigured. */
  order: { id: string; amount: number; currency: string } | null;
  /** Publishable Razorpay key for client checkout (never the secret). */
  keyId: string | null;
  /** Set when the enquiry persisted but the order could not be created — the vendor still gets the lead. */
  paymentError?: string;
}

/**
 * The Action Registry — the ONLY new persistence-adjacent code in the engine.
 *
 * Each entry holds REFERENCES, not logic: it points an industry-agnostic intent
 * at the real industry service method that already owns persistence, money math,
 * ownership guards and lifecycle side-effects. The engine adds no parallel
 * booking/ordering/payment system.
 *
 * Actions marked `public: true` may be fired by an anonymous website visitor
 * (vendorId resolved from the site subdomain); everything else is vendor-JWT only.
 */
@Injectable()
export class ActionRegistry {
  private readonly logger = new Logger(ActionRegistry.name);
  private readonly actions = new Map<string, ActionDefinition>();

  constructor(
    private readonly restaurant: RestaurantService,
    private readonly retail: RetailService,
    private readonly realestate: RealEstateService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
  ) {
    // ── restaurant.bill_order → RestaurantService.billOrder (vendor-only) ──
    this.register<BillOrderActionInput>({
      intent: 'restaurant.bill_order',
      industry: 'restaurant',
      delegatesTo: 'POST /restaurant/orders/:id/bill',
      description: 'Close a restaurant order, capture the payment method and free its table.',
      inputType: BillOrderActionInput,
      execute: (ctx, input) =>
        this.restaurant.billOrder(ctx.vendorId, input.orderId, { paymentMethod: input.paymentMethod }),
    });

    // ── retail.create_sale → RetailService.createSale (vendor-only) ──
    this.register<CreateSaleDto>({
      intent: 'retail.create_sale',
      industry: 'retail',
      delegatesTo: 'POST /retail/sales',
      description: 'Ring up a retail sale: validate stock, decrement inventory and write the receipt atomically.',
      inputType: CreateSaleDto,
      execute: (ctx, input) => this.retail.createSale(ctx.vendorId, input),
    });

    // ── realestate.enquiry → RealEstateService.createDeal (PUBLIC lead capture) ──
    // A public website enquiry lands in the vendor's real Real-Estate pipeline as a
    // stage:'new' deal — the same records the dashboard's DealsView shows.
    this.register<CreateDealDto>({
      intent: 'realestate.enquiry',
      industry: 'realestate',
      delegatesTo: 'POST /realestate/deals',
      description: 'Capture a property enquiry from the public website into the real-estate pipeline.',
      inputType: CreateDealDto,
      public: true,
      execute: async (ctx, input) => {
        const deal = await this.realestate.createDeal(ctx.vendorId, { ...input, stage: input.stage ?? 'new' });
        await this.routeLead(ctx.vendorId, 'realestate_enquiry', 'New website enquiry',
          `${input.clientName} enquired${input.clientPhone ? ` (${input.clientPhone})` : ''}.`, { dealId: deal.id });
        return deal;
      },
    });

    // ── realestate.site_visit → RealEstateService.createVisit (PUBLIC booking) ──
    this.register<CreateVisitDto>({
      intent: 'realestate.site_visit',
      industry: 'realestate',
      delegatesTo: 'POST /realestate/visits',
      description: 'Book a site visit from the public website into the real-estate visits calendar.',
      inputType: CreateVisitDto,
      public: true,
      execute: async (ctx, input) => {
        const visit = await this.realestate.createVisit(ctx.vendorId, input);
        await this.routeLead(ctx.vendorId, 'realestate_site_visit', 'New site-visit booking',
          `${input.clientName} booked a site visit for ${new Date(input.scheduledAt).toLocaleString('en-IN')}.`,
          { visitId: visit.id });
        return visit;
      },
    });

    // ── realestate.payment_cta → persist enquiry + PaymentsService.createOrder (PUBLIC) ──
    // Real transactional flow: a booking-token payment that both lands as a pipeline
    // deal AND creates a real (uncaptured) Razorpay order. Never a parallel ledger.
    this.register<RealEstatePaymentInput, PaymentCtaResult>({
      intent: 'realestate.payment_cta',
      industry: 'realestate',
      delegatesTo: 'POST /realestate/deals + POST /payments/create-order',
      description: 'Start a booking-token payment: persist the enquiry and create a Razorpay order for checkout.',
      inputType: RealEstatePaymentInput,
      public: true,
      execute: (ctx, input) => this.startRealEstatePayment(ctx.vendorId, input),
    });
  }

  /**
   * Persist the enquiry first (so the vendor never loses the lead), then attempt to
   * create the Razorpay order. Amount arrives in ₹ and is validated 100–500000 by the
   * DTO; converted to paise here. A gateway failure is non-fatal — the deal still
   * lands and `paymentError` is surfaced so the site can fall back to WhatsApp/callback.
   */
  private async startRealEstatePayment(vendorId: string, input: RealEstatePaymentInput): Promise<PaymentCtaResult> {
    const noteParts = [`Booking-token payment (₹${input.amount})`];
    if (input.propertyRef) noteParts.push(`for ${input.propertyRef}`);
    if (input.notes) noteParts.push(`— ${input.notes}`);
    const deal = await this.realestate.createDeal(vendorId, {
      clientName: input.clientName,
      clientPhone: input.clientPhone,
      stage: 'new',
      value: input.amount,
      notes: noteParts.join(' '),
    });

    const result: PaymentCtaResult = { dealId: deal.id, order: null, keyId: null };
    try {
      const order = await this.payments.createOrder({ amount: input.amount * 100, currency: 'INR', receipt: deal.id });
      result.order = { id: order.id, amount: Number(order.amount), currency: order.currency };
      result.keyId = process.env.RAZORPAY_KEY_ID ?? null;
    } catch (err) {
      result.paymentError = err instanceof Error ? err.message : 'Payment gateway unavailable';
      this.logger.warn(`RE payment order failed for vendor ${vendorId} (deal ${deal.id}): ${result.paymentError}`);
    }

    await this.routeLead(vendorId, 'realestate_token_payment', 'New booking-token payment',
      `${input.clientName} started a ₹${input.amount} token payment${input.propertyRef ? ` for ${input.propertyRef}` : ''}.`,
      { dealId: deal.id, amount: input.amount });
    return result;
  }

  /** Best-effort lead routing: notify the vendor in-app. Never fails the action. */
  private async routeLead(
    vendorId: string, type: string, title: string, message: string, data: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.notifications.notifyVendor(vendorId, type, title, message, {
        priority: 'ACTION', actionRequired: true, actionType: 'view_lead', actionData: data,
      });
    } catch (err) {
      this.logger.warn(`Lead-routing notification failed for vendor ${vendorId}: ${err instanceof Error ? err.message : 'error'}`);
    }
  }

  /** Register one action. Duplicate intents are a programming error. */
  private register<TInput extends object, TResult = unknown>(def: ActionDefinition<TInput, TResult>): void {
    if (this.actions.has(def.intent)) {
      throw new Error(`Duplicate engine action intent: ${def.intent}`);
    }
    this.actions.set(def.intent, def as unknown as ActionDefinition);
  }

  get(intent: string): ActionDefinition | undefined {
    return this.actions.get(intent);
  }

  /** Registered actions as descriptors (no executors) — for introspection/UI. */
  describe(): ActionDescriptor[] {
    return [...this.actions.values()].map(({ intent, industry, delegatesTo, description, public: isPublic }) => ({
      intent,
      industry,
      delegatesTo,
      description,
      public: isPublic ?? false,
    }));
  }
}
