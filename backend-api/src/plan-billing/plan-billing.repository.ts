import { DiscountRuleRow, TaxRateRow } from '../plans/pricing/price-quote';
import { Actor } from '../plans/admin/audit.service';
import { WalletTx } from '../v3-wallet/wallet.store';
import { OrderStatus } from './core/order-state';

export type OrderKind = 'NEW' | 'RENEWAL' | 'UPGRADE';
export interface PlanRow { id: string; key: string; track: string; level: 'FREE' | 'PRO'; name: string; status: 'DRAFT' | 'ACTIVE' | 'RETIRED'; isPublic: boolean }
export interface PriceRow { id: string; amountPaise: number; currency: string; taxInclusive: boolean }
export interface VendorRow { id: string; name: string; businessName: string; email: string; phone: string | null }
export interface SubRow {
  id: string; vendorId: string; planId: string; planKey: string; track: string; level: 'FREE' | 'PRO'; status: string; startsAt: Date; endsAt: Date | null; graceEndsAt: Date | null;
  termMonths: number | null; amountPaise: number | null;
}
export interface OrderRow {
  id: string; vendorId: string; planId: string; termMonths: number; kind: OrderKind; quote: Record<string, unknown>; amountPaise: number; currency: string; status: OrderStatus;
  providerOrderId: string | null; idempotencyKey: string; expiresAt: Date; createdByType: string; createdById: string | null; paymentId: string | null; paidAmountPaise: number | null;
  paidAt: Date | null; source: string | null; reason: string | null; subscriptionId: string | null; refundRecordedPaise: number | null; refundNote: string | null; refundRecordedBy: string | null; refundRecordedAt: Date | null;
  /** Wave 2 C6: what staff recorded when they marked the order paid offline */
  settledReference: string | null; settledOn: Date | null; settledAmountPaise: number | null; settledByName: string | null;
  /** Wave 3 Part C: the gateway the order was started on (razorpay when absent: every order before Wave 3) and the browser checkout's session token where the gateway has one (Cashfree) */
  gateway?: string; gatewayClientToken?: string | null;
  createdAt: Date; updatedAt: Date;
}
export type NewOrder = Pick<OrderRow, 'vendorId' | 'planId' | 'termMonths' | 'kind' | 'quote' | 'amountPaise' | 'currency' | 'idempotencyKey' | 'expiresAt' | 'createdByType' | 'createdById'> & Partial<Pick<OrderRow, 'gateway'>>;
export type OrderPatch = Partial<Pick<OrderRow, 'status' | 'providerOrderId' | 'paymentId' | 'paidAmountPaise' | 'paidAt' | 'source' | 'reason' | 'subscriptionId' | 'refundRecordedPaise' | 'refundNote' | 'refundRecordedBy' | 'refundRecordedAt' | 'settledReference' | 'settledOn' | 'settledAmountPaise' | 'settledByName' | 'gatewayClientToken'>>;
export interface InvoiceRow { id: string; vendorId: string; orderId: string; invoiceNumber: string; financialYear: string; issuedAt: Date; snapshot: Record<string, unknown>; taxBreakdown: Record<string, unknown> }
export interface EventRow { id: string; provider: string; providerEventId: string; type: string; payloadRedacted: Record<string, unknown>; signatureValid: boolean; orderId: string | null; processedAt: Date | null; result: string | null; createdAt: Date }
export interface DueSub { id: string; vendorId: string; endsAt: Date; status: string; email: string; businessName: string }

/** Thrown when (vendorId, idempotencyKey) already exists: the caller then returns the existing order. */
export class DuplicateOrderError extends Error { constructor() { super('duplicate order'); } }

export interface AssignArgs { vendorId: string; planKey: string; termMonths: number; endsAt: Date; source: 'SELF' | 'STAFF'; actor: Actor; reason: string; now: Date }

/** The writes that must happen together when a payment is settled: under a per-vendor lock, in one transaction. */
export interface BillingTx {
  getOrder(id: string): Promise<OrderRow | null>;
  /** Batch 4: an order made inside the transaction, so a plan renewal from the wallet leaves no order behind when the wallet cannot pay */
  createOrder(d: NewOrder): Promise<OrderRow>;
  updateOrderCas(id: string, expected: OrderStatus[], patch: OrderPatch): Promise<boolean>;
  currentSub(vendorId: string): Promise<SubRow | null>;
  vendor(vendorId: string): Promise<VendorRow | null>;
  getPlanById(id: string): Promise<PlanRow | null>;
  /** creates or replaces the vendor's current subscription through the slice 5.1 SubscriptionsService (the previous one is closed, a ledger event and an audit row are written) */
  assign(a: AssignArgs): Promise<{ id: string; endsAt: Date | null }>;
  /** next gap-free number of the financial year (the counter row is locked by the transaction) */
  nextInvoiceNumber(financialYear: string): Promise<number>;
  insertInvoice(d: Omit<InvoiceRow, 'id'>): Promise<InvoiceRow>;
  audit(actor: Actor, action: string, entityId: string | null, before: unknown, after: unknown): Promise<void>;
  /** Batch 4: the wallet's side of THIS transaction (plan renewal from the wallet: the charge and the term start commit together). Absent when the wallet module is not installed. */
  walletTx?(): Promise<WalletTx>;
}

export abstract class PlanBillingRepository {
  abstract getPlanByKey(key: string): Promise<PlanRow | null>;
  abstract getPlanById(id: string): Promise<PlanRow | null>;
  abstract activePrice(planId: string, termMonths: number, now: Date): Promise<PriceRow | null>;
  abstract taxRates(): Promise<TaxRateRow[]>;
  abstract discountRules(): Promise<DiscountRuleRow[]>;
  abstract vendor(vendorId: string): Promise<VendorRow | null>;
  abstract currentSub(vendorId: string): Promise<SubRow | null>;

  abstract getOrder(id: string): Promise<OrderRow | null>;
  abstract findOrderByProviderId(providerOrderId: string): Promise<OrderRow | null>;
  abstract findOrderByIdempotency(vendorId: string, key: string): Promise<OrderRow | null>;
  abstract createOrder(d: NewOrder): Promise<OrderRow>;
  abstract updateOrderCas(id: string, expected: OrderStatus[], patch: OrderPatch): Promise<boolean>;
  abstract listOrdersForVendor(vendorId: string, skip: number, take: number): Promise<{ items: OrderRow[]; total: number }>;
  abstract listOrders(q: { vendorId?: string; status?: OrderStatus; gateway?: string; from?: Date; to?: Date; skip: number; take: number }): Promise<{ items: OrderRow[]; total: number }>;
  /** marks CREATED / PENDING_PAYMENT orders past their expiry as EXPIRED; returns how many */
  abstract expireStale(now: Date): Promise<number>;

  /** Wave 3 Part E: the invoice a paid order produced, or null */
  abstract getInvoiceByOrder(orderId: string): Promise<InvoiceRow | null>;
  abstract listInvoicesForVendor(vendorId: string, skip: number, take: number): Promise<{ items: InvoiceRow[]; total: number }>;
  /** Staff (C7): every vendor's plan invoices, newest first, paged, by vendor and by status (PAID, or REFUND_RECORDED once a refund was recorded on the order). */
  abstract listInvoicesForStaff(q: { vendorId?: string; status?: 'PAID' | 'REFUND_RECORDED'; skip: number; take: number }): Promise<{ items: Array<InvoiceRow & { paidAmountPaise: number | null; refundRecordedPaise: number | null }>; total: number }>;
  /** One of THIS vendor's invoices; null for another vendor's id or one that does not exist. */
  abstract getInvoiceForVendor(vendorId: string, id: string): Promise<InvoiceRow | null>;

  /** inserts the event, or returns the existing row when the provider event id was seen before */
  abstract insertEvent(d: { providerEventId: string; type: string; payloadRedacted: Record<string, unknown>; signatureValid: boolean; orderId: string | null; provider?: string }): Promise<{ created: boolean; row: EventRow }>;
  abstract finishEvent(providerEventId: string, patch: { processedAt: Date; result: string; orderId?: string | null }): Promise<void>;
  abstract listEvents(q: { orderId?: string; skip: number; take: number }): Promise<{ items: EventRow[]; total: number }>;

  /** Wave 3 Part D: the invoice mail is recorded in the message outbox (one row per invoice). QUEUED means pending: the mail switch is off or the mail is not sent yet. */
  abstract findInvoiceDelivery(invoiceId: string): Promise<{ id: string; status: string } | null>;
  abstract addInvoiceDelivery(d: { vendorId: string; invoiceId: string; toHash: string; toMasked: string; payload: Record<string, unknown> }): Promise<{ id: string }>;
  abstract setInvoiceDeliveryStatus(id: string, status: 'DELIVERED' | 'FAILED'): Promise<void>;

  abstract transaction<T>(vendorId: string, fn: (tx: BillingTx) => Promise<T>): Promise<T>;

  abstract dueSubscriptions(now: Date, maxDays: number): Promise<DueSub[]>;
  abstract loggedReminders(subscriptionIds: string[]): Promise<Set<string>>;
  /** false when this (subscription, offset, end date) was logged before */
  abstract insertReminder(d: { subscriptionId: string; daysBefore: number; endsAt: Date; kind: 'SENT' | 'SKIPPED' }): Promise<boolean>;
}
