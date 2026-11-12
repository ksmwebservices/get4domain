import { Actor } from '../plans/admin/audit.service';
import { MarginKind, OrderStatus } from './core/registrar-core';
import { WalletTx } from '../v3-wallet/wallet.store';

export type OrderKind = 'REGISTER' | 'RENEW' | 'TRANSFER_IN';
export interface OrderRow {
  id: string; vendorId: string; kind: OrderKind; domain: string; tld: string; years: number; status: OrderStatus; registeredDomainId: string | null; amountPaise: number; costPaise: number; marginPaise: number; privacyPaise: number;
  taxSnapshot: Record<string, unknown>; holdLedgerId: string | null; chargeLedgerId: string | null; releaseLedgerId: string | null; rcOrderId: string | null; privacy: boolean; fundedBy: 'WALLET';
  requestedByType: 'VENDOR' | 'STAFF'; requestedById: string | null; reason: string | null; idempotencyKey: string; openKey: string | null; failureCode: string | null; createdAt: Date; updatedAt: Date;
}
export type NewOrder = Pick<OrderRow, 'vendorId' | 'kind' | 'domain' | 'tld' | 'years' | 'registeredDomainId' | 'amountPaise' | 'costPaise' | 'marginPaise' | 'privacyPaise' | 'taxSnapshot' | 'privacy' | 'requestedByType' | 'requestedById' | 'reason' | 'idempotencyKey' | 'openKey'> & { id: string };
export type OrderPatch = Partial<Pick<OrderRow, 'status' | 'holdLedgerId' | 'chargeLedgerId' | 'releaseLedgerId' | 'rcOrderId' | 'registeredDomainId' | 'failureCode' | 'openKey'>>;

export interface RegisteredRow {
  id: string; vendorId: string; domain: string; tld: string; rcOrderId: string | null; status: 'ACTIVE' | 'EXPIRED'; expiresAt: Date | null; privacy: boolean; nameServers: string[]; dnsStatus: 'PENDING' | 'CONNECTED';
  alertsSent: number[]; registeredAt: Date; lastRenewedAt: Date | null;
}
export type NewRegistered = Pick<RegisteredRow, 'vendorId' | 'domain' | 'tld' | 'rcOrderId' | 'expiresAt' | 'privacy' | 'nameServers'>;
export type RegisteredPatch = Partial<Pick<RegisteredRow, 'status' | 'expiresAt' | 'privacy' | 'nameServers' | 'dnsStatus' | 'alertsSent' | 'lastRenewedAt' | 'rcOrderId'>>;

export interface InvoiceRow { id: string; vendorId: string; orderId: string; number: string; financialYear: string; snapshot: Record<string, unknown>; totalPaise: number; issuedAt: Date }

export interface MarginDbRow { id: string; tld: string; kind: MarginKind; value: number; status: 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'RETIRED'; effectiveFrom: Date | null; note: string | null; createdBy: string | null; approvedBy: string | null; approvedAt: Date | null; createdAt: Date }

export type RegistrantStatus = 'INCOMPLETE' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
export interface RegistrantRow {
  vendorId: string; legalName: string; company: string; email: string; phoneCc: string; phone: string; addressLine1: string; city: string; state: string; country: string; zipcode: string;
  emailVerifiedAt: Date | null; phoneVerifiedAt: Date | null; docKind: string | null; docLast4: string | null; docMime: string | null; docBytes: number | null; docUploadedAt: Date | null; docPurgedAt: Date | null;
  status: RegistrantStatus; reviewedBy: string | null; reviewedAt: Date | null; reviewNote: string | null; consentAt: Date | null; updatedAt: Date;
}
export type RegistrantFields = Pick<RegistrantRow, 'legalName' | 'company' | 'email' | 'phoneCc' | 'phone' | 'addressLine1' | 'city' | 'state' | 'country' | 'zipcode'>;
export type RegistrantPatch = Partial<Pick<RegistrantRow, 'emailVerifiedAt' | 'phoneVerifiedAt' | 'docKind' | 'docLast4' | 'docMime' | 'docBytes' | 'docUploadedAt' | 'docPurgedAt' | 'status' | 'reviewedBy' | 'reviewedAt' | 'reviewNote' | 'consentAt'>>;
export interface DocBlob { cipher: Buffer; iv: Buffer; tag: Buffer }
export interface OtpRow { id: string; vendorId: string; channel: 'EMAIL' | 'PHONE'; toHash: string; codeHash: string; expiresAt: Date; attempts: number; consumedAt: Date | null; createdAt: Date }
export type AccessAction = 'DOCUMENT_UPLOADED' | 'DOCUMENT_VIEWED' | 'APPROVED' | 'REJECTED' | 'DOCUMENT_PURGED';
export interface RunRow { id: string; startedAt: Date; finishedAt: Date | null; checked: number; settled: number; mismatches: unknown[]; balancePaise: number | null; status: 'RUNNING' | 'DONE' | 'FAILED'; note: string | null }

/** Thrown by `insertOrder` when (vendorId, idempotencyKey) or the live name already exists. */
export class DuplicateOrderError extends Error { constructor(readonly which: 'KEY' | 'NAME') { super('duplicate order'); } }

/** Everything one purchase step touches inside ONE unit of work (the vendor's wallet lock, a database transaction in production). A throw rolls all of it back, ledger entries included. */
export interface RegistrarTx {
  readonly vendorId: string;
  orderByKey(key: string): Promise<OrderRow | null>;
  order(id: string): Promise<OrderRow | null>;
  insertOrder(d: NewOrder): Promise<OrderRow>;
  /** compare and set on the status */
  updateOrder(id: string, expected: OrderStatus[], patch: OrderPatch): Promise<OrderRow | null>;
  registeredByDomain(domain: string): Promise<RegisteredRow | null>;
  registered(id: string): Promise<RegisteredRow | null>;
  insertRegistered(d: NewRegistered): Promise<RegisteredRow>;
  updateRegistered(id: string, patch: RegisteredPatch): Promise<RegisteredRow | null>;
  /** brings the registered name into the vendor's own domains (CUSTOM, ACTIVE, verified by the registrar); returns the domain id (new or the vendor's own), or null when another vendor holds that host */
  adoptDomain(host: string, now: Date): Promise<string | null>;
  customer(): Promise<{ rcCustomerId: string; rcContactId: string } | null>;
  invoiceForOrder(orderId: string): Promise<InvoiceRow | null>;
  insertInvoice(d: Omit<InvoiceRow, 'id'>): Promise<InvoiceRow>;
  audit(actor: Actor, action: string, entityId: string | null, before: unknown, after: unknown): Promise<void>;
}

/** Domain sales storage (slice 5.6d). Prisma below; a memory twin lives in test/support. Every vendor query names the vendor; the few across vendors are staff or job reads and are read only. */
export abstract class RegistrarStore {
  /** one vendor, one unit of work: waits in the in-process queue first, then runs under the vendor's wallet lock with the order rows and the ledger in one transaction */
  abstract unit<T>(vendorId: string, fn: (t: RegistrarTx, w: WalletTx) => Promise<T>): Promise<T>;
  // price book
  abstract margins(): Promise<MarginDbRow[]>;
  abstract getMargin(id: string): Promise<MarginDbRow | null>;
  abstract insertMargin(d: Pick<MarginDbRow, 'tld' | 'kind' | 'value' | 'note' | 'createdBy'>): Promise<MarginDbRow | null>;
  abstract updateMargin(id: string, expected: MarginDbRow['status'][], patch: Partial<Pick<MarginDbRow, 'status' | 'effectiveFrom' | 'approvedBy' | 'approvedAt'>>): Promise<MarginDbRow | null>;
  // registrant and identity
  abstract registrant(vendorId: string): Promise<RegistrantRow | null>;
  abstract saveRegistrant(vendorId: string, f: RegistrantFields, resetEmail: boolean, resetPhone: boolean): Promise<RegistrantRow>;
  abstract patchRegistrant(vendorId: string, expected: RegistrantStatus[] | null, patch: RegistrantPatch): Promise<RegistrantRow | null>;
  abstract storeDocument(vendorId: string, blob: DocBlob, meta: { kind: string; last4: string | null; mime: string; bytes: number; at: Date }): Promise<RegistrantRow | null>;
  abstract readDocument(vendorId: string): Promise<(DocBlob & { mime: string; kind: string }) | null>;
  abstract purgeDocument(vendorId: string, at: Date): Promise<boolean>;
  abstract insertOtp(d: Omit<OtpRow, 'id' | 'attempts' | 'consumedAt' | 'createdAt'> & { createdAt: Date }): Promise<OtpRow>;
  abstract latestOtp(vendorId: string, channel: 'EMAIL' | 'PHONE'): Promise<OtpRow | null>;
  abstract updateOtp(vendorId: string, id: string, patch: { attempts?: number; consumedAt?: Date }): Promise<void>;
  abstract logAccess(vendorId: string, staffId: string | null, action: AccessAction, reason: string | null, at: Date): Promise<void>;
  abstract accessLog(vendorId: string, skip: number, take: number): Promise<{ items: Array<{ staffId: string | null; action: string; reason: string | null; at: Date }>; total: number }>;
  abstract reviewQueue(status: RegistrantStatus | undefined, skip: number, take: number): Promise<{ items: RegistrantRow[]; total: number }>;
  /** registrants whose document is past the retention (decided and older than the cut-off); the purge job's work list */
  abstract documentsDueForPurge(decidedBefore: Date, limit: number): Promise<string[]>;
  // customer, orders, registered domains
  abstract customer(vendorId: string): Promise<{ rcCustomerId: string; rcContactId: string } | null>;
  abstract saveCustomer(vendorId: string, rcCustomerId: string, rcContactId: string): Promise<{ rcCustomerId: string; rcContactId: string }>;
  abstract orderByKey(vendorId: string, key: string): Promise<OrderRow | null>;
  abstract order(vendorId: string, id: string): Promise<OrderRow | null>;
  abstract ordersForVendor(vendorId: string, skip: number, take: number): Promise<{ items: OrderRow[]; total: number }>;
  abstract ordersForStaff(f: { vendorId?: string; status?: OrderStatus; kind?: OrderKind }, skip: number, take: number): Promise<{ items: OrderRow[]; total: number }>;
  /** unsettled orders last touched before the cut-off: CREATED, HELD, SUBMITTED, UNKNOWN (recovery and reconciliation work lists; across vendors, read only) */
  abstract unsettledOrders(before: Date, limit: number): Promise<OrderRow[]>;
  abstract registeredForVendor(vendorId: string): Promise<RegisteredRow[]>;
  abstract registeredOne(vendorId: string, id: string): Promise<RegisteredRow | null>;
  abstract registeredByName(domain: string): Promise<RegisteredRow | null>;
  abstract activeRegistered(limit: number): Promise<RegisteredRow[]>;
  abstract patchRegistered(vendorId: string, id: string, patch: RegisteredPatch): Promise<RegisteredRow | null>;
  abstract invoiceForOrder(vendorId: string, orderId: string): Promise<InvoiceRow | null>;
  // runs
  abstract insertRun(at: Date): Promise<RunRow>;
  abstract finishRun(id: string, patch: Partial<Pick<RunRow, 'finishedAt' | 'checked' | 'settled' | 'mismatches' | 'balancePaise' | 'status' | 'note'>>): Promise<void>;
  abstract lastRuns(take: number): Promise<RunRow[]>;
}
