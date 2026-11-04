import { Actor } from '../plans/admin/audit.service';
import { MethodKind, MethodStatus, OfferTerms } from './core/commerce-core';
import { RequestKind, RequestStatus } from './core/requests-core';
import { Channel } from './core/messaging-core';

export type RequestSource = 'DIRECTORY' | 'SITE' | 'WHATSAPP' | 'MANUAL';
export type ActorType = 'CUSTOMER' | 'VENDOR' | 'STAFF' | 'SYSTEM';
export type OrderStatus = 'PLACED' | 'AWAITING_PAYMENT' | 'PAID' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED' | 'REFUNDED_RECORDED';
export type PaymentMode = 'ONLINE' | 'COD' | 'AT_VISIT' | 'MANUAL';

export interface RequestRow {
  id: string; vendorId: string; siteHost: string; kind: RequestKind; status: RequestStatus; customerName: string; customerPhoneE164: string; customerEmail: string | null; payload: Record<string, unknown>;
  sourceKind: RequestSource; directoryRefHash: string | null; utmSource: string | null; utmMedium: string | null; utmCampaign: string | null; idempotencyKey: string; spamScore: number;
  firstSeenAt: Date | null; firstResponseAt: Date | null; expiresAt: Date; convertedCustomerId: string | null; convertedBookingId: string | null; createdAt: Date; updatedAt: Date;
}
export interface EventRow { id: string; requestId: string; type: string; actorType: ActorType; channel: string | null; deliveryResult: string | null; at: Date; meta: Record<string, unknown> }
export interface NewEvent { type: string; actorType: ActorType; channel?: string | null; deliveryResult?: string | null; meta?: Record<string, unknown> }
export interface ConsentInput { textVersion: number; textHash: string; ipHash: string | null; contactByBusiness: boolean; contactByPlatform: boolean; marketing: boolean }
export interface NewRequest {
  vendorId: string; siteHost: string; kind: RequestKind; status: RequestStatus; customerName: string; customerPhoneE164: string; customerEmail: string | null; payload: Record<string, unknown>; sourceKind: RequestSource;
  directoryRefHash: string | null; utmSource: string | null; utmMedium: string | null; utmCampaign: string | null; idempotencyKey: string; spamScore: number; expiresAt: Date;
  consent: ConsentInput; trackingTokenHash: string | null; trackingExpiresAt: Date | null; events: NewEvent[];
}
export interface RequestFilter { status?: RequestStatus; kind?: RequestKind; q?: string; from?: Date; to?: Date; skip: number; take: number }

export interface MethodRow { id: string; vendorId: string; kind: MethodKind; label: string; last4: string | null; hasSecret: boolean; hasWebhookSecret: boolean; status: MethodStatus; verifiedAt: Date | null; createdAt: Date; updatedAt: Date }
export interface SealedBox { cipher: string | null; iv: string | null; tag: string | null }
export interface MethodSecrets { config: SealedBox; webhook: SealedBox }

export interface OrderRow { id: string; vendorId: string; requestId: string; orderNo: number; status: OrderStatus; paymentMode: PaymentMode; methodId: string | null; amountPaise: number; currency: string; reviewFlag: boolean; shipping: Record<string, unknown>; tracking: Record<string, unknown>; refundedPaise: number; paidAt: Date | null; createdAt: Date; updatedAt: Date }
export interface OrderItemRow { id: string; orderId: string; productRef: string; name: string; qty: number; unitPaise: number; tax: Record<string, unknown> }
export interface NewOrder {
  request: NewRequest; paymentMode: PaymentMode; methodId: string | null; amountPaise: number; currency: string; shipping: Record<string, unknown>;
  items: Array<{ productRef: string; name: string; qty: number; unitPaise: number; tax: Record<string, unknown> }>; offerId: string | null; reserveUntil: Date;
}
export interface InvoiceRow { id: string; vendorId: string; orderId: string | null; requestId: string | null; seq: number; invoiceNumber: string; issuedAt: Date; snapshot: Record<string, unknown>; status: 'ISSUED' | 'VOID'; voidedAt: Date | null; voidReason: string | null }
export interface OfferRow extends OfferTerms { id: string; vendorId: string; title: string; createdAt: Date; updatedAt: Date; code: string | null }
export interface OutboxRow { id: string; vendorId: string | null; channel: Channel | 'DASHBOARD'; templateKey: string; toHash: string; toMasked: string; payload: Record<string, unknown>; senderRoute: string; status: 'QUEUED' | 'SENT_SANDBOX' | 'FAILED' | 'DELIVERED'; attempts: number; relatedRequestId: string | null; createdAt: Date }
export interface ReportRow { id: string; reportedHost: string; reasonKind: string; text: string; reporterContactMasked: string | null; status: 'OPEN' | 'REVIEWED' | 'ACTIONED' | 'REJECTED'; handledBy: string | null; handledAt: Date | null; createdAt: Date }
export interface BlockRow { id: string; kind: 'PHONE_HASH' | 'IP_HASH' | 'EMAIL_HASH'; hash: string; reason: string; addedBy: string | null; at: Date }

export class StockUnavailable extends Error { constructor(readonly productRef: string) { super('STOCK_UNAVAILABLE'); } }
export class OfferUsedUp extends Error { constructor() { super('OFFER_USED_UP'); } }

/**
 * Everything slice 5.14 stores, behind one port: a Prisma implementation and an in-memory twin for the unit tests. The mutating methods that must be atomic (placing an order, marking an
 * order paid, taking the next number) are single methods so each is ONE transaction. Request events, payment events, the register-like tables are append-only here.
 */
export abstract class RequestsStore {
  // requests
  abstract findByIdempotency(vendorId: string, key: string): Promise<RequestRow | null>;
  abstract createRequest(r: NewRequest): Promise<RequestRow>;
  abstract getRequest(id: string, vendorId?: string): Promise<RequestRow | null>;
  abstract listRequests(vendorId: string | null, f: RequestFilter): Promise<{ items: RequestRow[]; total: number }>;
  abstract transition(id: string, from: RequestStatus, to: RequestStatus, patch: { firstSeenAt?: Date; firstResponseAt?: Date }, event: NewEvent): Promise<RequestRow | null>;
  abstract addEvent(requestId: string, e: NewEvent, at: Date): Promise<void>;
  abstract events(requestId: string): Promise<EventRow[]>;
  abstract setLinks(id: string, vendorId: string, links: { customerId?: string; bookingId?: string }): Promise<RequestRow | null>;
  abstract trackingByHash(hash: string): Promise<{ request: RequestRow; expiresAt: Date } | null>;
  abstract countRecentByPhone(vendorId: string, phone: string, since: Date): Promise<number>;
  abstract countRecentByIp(ipHash: string, since: Date): Promise<number>;
  abstract findRecentDuplicate(vendorId: string, phone: string, kind: RequestKind, payload: Record<string, unknown>, since: Date): Promise<RequestRow | null>;
  abstract expirable(now: Date, limit: number): Promise<RequestRow[]>;
  abstract nudgeCandidates(before: Date, limit: number): Promise<RequestRow[]>;

  // payment methods (secrets are sealed by the caller; the row views never carry them)
  abstract createMethod(d: { vendorId: string; kind: MethodKind; label: string; last4: string | null; config: SealedBox; webhook: SealedBox }): Promise<MethodRow>;
  abstract listMethods(vendorId: string): Promise<MethodRow[]>;
  abstract getMethod(id: string, vendorId?: string): Promise<MethodRow | null>;
  abstract methodSecrets(id: string, vendorId: string): Promise<MethodSecrets | null>;
  abstract updateMethod(id: string, vendorId: string, p: { label?: string; status?: MethodStatus; verifiedAt?: Date | null; last4?: string | null; config?: SealedBox; webhook?: SealedBox }): Promise<MethodRow | null>;

  // orders
  abstract placeOrder(o: NewOrder): Promise<{ order: OrderRow; request: RequestRow; items: OrderItemRow[] }>;
  abstract getOrder(id: string, vendorId?: string): Promise<{ order: OrderRow; items: OrderItemRow[] } | null>;
  abstract orderByRequest(requestId: string): Promise<{ order: OrderRow; items: OrderItemRow[] } | null>;
  abstract listOrders(vendorId: string, f: { status?: OrderStatus; skip: number; take: number }): Promise<{ items: OrderRow[]; total: number }>;
  abstract moveOrder(id: string, vendorId: string, from: OrderStatus, to: OrderStatus, patch: { tracking?: Record<string, unknown> }): Promise<OrderRow | null>;
  /** exactly once: PLACED or AWAITING_PAYMENT becomes PAID, the reservations become stock reductions, the invoice number is taken. A second call returns alreadyPaid. */
  abstract markPaid(orderId: string, vendorId: string, now: Date): Promise<{ order: OrderRow; alreadyPaid: boolean; invoice: InvoiceRow | null }>;
  abstract flagReview(orderId: string, vendorId: string): Promise<void>;
  abstract recordRefund(orderId: string, vendorId: string, amountPaise: number): Promise<OrderRow | null>;
  abstract recordPaymentEvent(e: { vendorId: string; methodId: string; providerEventId: string; signatureValid: boolean; payload: Record<string, unknown>; result: string }): Promise<boolean>;

  // invoices, offers, stock
  abstract createInvoice(d: { vendorId: string; orderId: string | null; requestId: string | null; snapshot: Record<string, unknown>; prefix: string; now: Date }): Promise<InvoiceRow>;
  abstract listInvoices(vendorId: string, skip: number, take: number): Promise<{ items: InvoiceRow[]; total: number }>;
  abstract getInvoice(id: string, vendorId: string): Promise<InvoiceRow | null>;
  abstract voidInvoice(id: string, vendorId: string, reason: string, now: Date): Promise<InvoiceRow | null>;
  abstract createOffer(d: Omit<OfferRow, 'id' | 'usedCount' | 'createdAt' | 'updatedAt'>): Promise<OfferRow>;
  abstract listOffers(vendorId: string): Promise<OfferRow[]>;
  abstract getOffer(id: string, vendorId: string): Promise<OfferRow | null>;
  abstract offerByCode(vendorId: string, code: string): Promise<OfferRow | null>;
  abstract updateOffer(id: string, vendorId: string, p: Partial<Pick<OfferRow, 'title' | 'percentOff' | 'flatPaise' | 'minOrderPaise' | 'startsAt' | 'endsAt' | 'usageLimit' | 'status'>>): Promise<OfferRow | null>;
  abstract setStock(vendorId: string, productRef: string, onHand: number): Promise<void>;
  abstract getStock(vendorId: string, productRef: string): Promise<{ onHand: number; reserved: number } | null>;
  abstract releaseExpiredReservations(now: Date): Promise<number>;

  // messages
  abstract addMessage(m: Omit<OutboxRow, 'id' | 'createdAt'>, at: Date): Promise<OutboxRow>;
  abstract listOutbox(f: { vendorId?: string; requestId?: string; skip: number; take: number }): Promise<{ items: OutboxRow[]; total: number }>;
  abstract suppressed(hash: string, channel: Channel): Promise<boolean>;
  abstract addSuppression(hash: string, channel: Channel): Promise<boolean>;

  // reports and the blocklist
  abstract createReport(r: Omit<ReportRow, 'id' | 'status' | 'handledBy' | 'handledAt' | 'createdAt'>): Promise<ReportRow>;
  abstract listReports(f: { status?: ReportRow['status']; skip: number; take: number }): Promise<{ items: ReportRow[]; total: number }>;
  abstract handleReport(id: string, status: ReportRow['status'], by: string | null, now: Date): Promise<ReportRow | null>;
  abstract addBlock(b: Omit<BlockRow, 'id' | 'at'>, at: Date): Promise<BlockRow>;
  abstract listBlocks(skip: number, take: number): Promise<{ items: BlockRow[]; total: number }>;
  abstract removeBlock(id: string): Promise<boolean>;
  abstract isBlocked(kind: BlockRow['kind'], hash: string): Promise<boolean>;

  abstract recordAudit(actor: Actor, action: string, entityType: string, entityId: string | null, before: unknown, after: unknown): Promise<void>;
}
