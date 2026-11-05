import { Actor } from '../plans/admin/audit.service';
import { ServicesTx } from '../v3-services/services.store';
import { WalletTx } from '../v3-wallet/wallet.store';
import { FundingKind, RequestStatus } from './core/request-core';

export type Creator = 'VENDOR' | 'STAFF_ON_BEHALF';
export type DeliverableKind = 'TEXT' | 'FILE_REF' | 'LINK';

export interface RequestRow {
  id: string; vendorId: string; serviceId: string; serviceKey: string; status: RequestStatus; brief: Record<string, unknown>; attachmentRefs: string[];
  priceSnapshotPaise: number | null; taxSnapshot: Record<string, unknown>; fundingKind: FundingKind; holdLedgerId: string | null; chargeLedgerId: string | null; packPurchaseId: string | null;
  assignedStaffId: string | null; slaDueAt: Date | null; slaBreachedAt: Date | null; readyAt: Date | null; revisionsUsed: number; grantEndsAt: Date | null; grantOverrideId: string | null;
  createdByType: Creator; createdById: string | null; idempotencyKey: string; rejectReason: string | null; approvedAt: Date | null; cancelledAt: Date | null; createdAt: Date; updatedAt: Date;
}
export type NewRequest = Omit<RequestRow, 'serviceKey' | 'createdAt' | 'updatedAt' | 'chargeLedgerId' | 'assignedStaffId' | 'slaDueAt' | 'slaBreachedAt' | 'readyAt' | 'revisionsUsed' | 'grantEndsAt' | 'grantOverrideId' | 'rejectReason' | 'approvedAt' | 'cancelledAt'>;
export type RequestPatch = Partial<Pick<RequestRow, 'status' | 'chargeLedgerId' | 'packPurchaseId' | 'assignedStaffId' | 'slaDueAt' | 'slaBreachedAt' | 'readyAt' | 'revisionsUsed' | 'grantEndsAt' | 'grantOverrideId' | 'rejectReason' | 'approvedAt' | 'cancelledAt' | 'attachmentRefs'>>;

export interface EventRow { id: string; requestId: string; vendorId: string; type: string; fromStatus: string | null; toStatus: string | null; actorType: string; actorId: string | null; note: string | null; meta: Record<string, unknown>; at: Date }
export type NewEvent = Omit<EventRow, 'id' | 'at'> & { at: Date };
export interface DeliverableRow { id: string; requestId: string; vendorId: string; kind: DeliverableKind; text: string | null; fileRef: string | null; createdBy: string | null; createdAt: Date }
export type NewDeliverable = Omit<DeliverableRow, 'id'>;
export interface InvoiceRow { id: string; vendorId: string; requestId: string; invoiceNumber: string; financialYear: string; issuedAt: Date; ledgerEntryId: string; snapshot: Record<string, unknown>; taxBreakdown: Record<string, unknown> }
export type NewInvoice = Omit<InvoiceRow, 'id'>;

export class DuplicateRequestError extends Error { constructor() { super('duplicate request'); } }

export interface AdminRequestFilter { serviceKey?: string; status?: RequestStatus; fundingKind?: FundingKind; vendorId?: string; slaBreached?: boolean; now: Date; skip: number; take: number }

/** The service-request side of ONE unit of work for one vendor. A throw rolls back the request rows, the services rows and the wallet rows together. */
export interface RequestsTx {
  insertRequest(d: NewRequest): Promise<RequestRow>;
  getRequest(id: string): Promise<RequestRow | null>;
  findByKey(key: string): Promise<RequestRow | null>;
  /** compare-and-set on the status: false when the request is no longer in one of the expected states */
  updateRequestCas(id: string, expected: RequestStatus[], patch: RequestPatch): Promise<boolean>;
  /** a change that is not a state change (assigning, the SLA, the promotion end date) */
  patchRequest(id: string, patch: RequestPatch): Promise<void>;
  insertEvent(d: NewEvent): Promise<void>;
  events(requestId: string): Promise<EventRow[]>;
  insertDeliverable(d: NewDeliverable): Promise<DeliverableRow>;
  deliverables(requestId: string): Promise<DeliverableRow[]>;
  insertInvoice(d: NewInvoice): Promise<InvoiceRow>;
  invoiceFor(requestId: string): Promise<InvoiceRow | null>;
  /** this vendor's requests for a service that are paid by the plan allowance and not cancelled or rejected, since the current plan term began */
  allowanceUsed(serviceId: string): Promise<number>;
  /** this vendor's OPEN pack-funded requests for a service: each one has a unit of a pack set aside until it is approved or ends */
  packReserved(serviceId: string): Promise<number>;
  /** the one who claims the right to create the promotion override; false when someone already did */
  claimGrant(id: string): Promise<boolean>;
  finishGrant(id: string, overrideId: string | null): Promise<void>;
  audit(actor: Actor, action: string, entityId: string | null, before: unknown, after: unknown): Promise<void>;
}

export abstract class RequestsStore {
  /** one vendor, one unit of work: the in-process queue first, then the transaction and the lock; the request side, the services side and the wallet side all share it */
  abstract unit<T>(vendorId: string, fn: (r: RequestsTx, s: ServicesTx, w: WalletTx) => Promise<T>): Promise<T>;
  abstract listForVendor(vendorId: string, skip: number, take: number): Promise<{ items: RequestRow[]; total: number }>;
  abstract getForVendor(vendorId: string, id: string): Promise<RequestRow | null>;
  abstract detail(requestId: string): Promise<{ events: EventRow[]; deliverables: DeliverableRow[]; invoice: InvoiceRow | null }>;
  abstract invoicesForVendor(vendorId: string, skip: number, take: number): Promise<{ items: InvoiceRow[]; total: number }>;
  abstract adminList(f: AdminRequestFilter): Promise<{ items: RequestRow[]; total: number }>;
  abstract adminGet(id: string): Promise<RequestRow | null>;
  abstract slaCandidates(now: Date, limit: number): Promise<RequestRow[]>;
  abstract autoApproveCandidates(readyBefore: Date, limit: number): Promise<RequestRow[]>;
  /** used by the plan allowance count shown in the catalogue */
  abstract allowanceUsedFor(vendorId: string, serviceKey: string): Promise<number>;
}
