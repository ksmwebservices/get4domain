import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Actor, AuditService } from '../plans/admin/audit.service';
import { ServicesStore, ServicesTx } from '../v3-services/services.store';
import { WalletTx } from '../v3-wallet/wallet.store';
import { RequestStatus } from './core/request-core';
import {
  AdminRequestFilter, DeliverableRow, DuplicateRequestError, EventRow, InvoiceRow, NewDeliverable, NewEvent, NewInvoice, NewRequest, RequestPatch, RequestRow, RequestsStore, RequestsTx,
} from './requests.store';

const isUnique = (e: unknown): boolean => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
type ReqDb = Prisma.V3ServiceRequestGetPayload<{ include: { service: { select: { key: true } } } }>;
const INCLUDE = { service: { select: { key: true } } } as const;

const toRequest = (r: ReqDb): RequestRow => ({
  id: r.id, vendorId: r.vendorId, serviceId: r.serviceId, serviceKey: r.service.key, status: r.status, brief: obj(r.briefJson), attachmentRefs: (Array.isArray(r.attachmentRefs) ? r.attachmentRefs : []).filter((x): x is string => typeof x === 'string'),
  priceSnapshotPaise: r.priceSnapshotPaise, taxSnapshot: obj(r.taxSnapshotJson), fundingKind: r.fundingKind, holdLedgerId: r.holdLedgerId, chargeLedgerId: r.chargeLedgerId, packPurchaseId: r.packPurchaseId,
  assignedStaffId: r.assignedStaffId, slaDueAt: r.slaDueAt, slaBreachedAt: r.slaBreachedAt, readyAt: r.readyAt, revisionsUsed: r.revisionsUsed, grantEndsAt: r.grantEndsAt, grantOverrideId: r.grantOverrideId,
  createdByType: r.createdByType, createdById: r.createdById, idempotencyKey: r.idempotencyKey, rejectReason: r.rejectReason, approvedAt: r.approvedAt, cancelledAt: r.cancelledAt, createdAt: r.createdAt, updatedAt: r.updatedAt,
});
const toEvent = (e: Prisma.V3ServiceRequestEventGetPayload<Record<string, never>>): EventRow => ({ id: e.id, requestId: e.requestId, vendorId: e.vendorId, type: e.type, fromStatus: e.fromStatus, toStatus: e.toStatus, actorType: e.actorType, actorId: e.actorId, note: e.note, meta: obj(e.metaJson), at: e.at });
const toDeliverable = (d: Prisma.V3ServiceDeliverableGetPayload<Record<string, never>>): DeliverableRow => ({ id: d.id, requestId: d.requestId, vendorId: d.vendorId, kind: d.kind, text: d.text, fileRef: d.fileRef, createdBy: d.createdBy, createdAt: d.createdAt });
const toInvoice = (i: Prisma.V3ServiceInvoiceGetPayload<Record<string, never>>): InvoiceRow => ({ id: i.id, vendorId: i.vendorId, requestId: i.requestId, invoiceNumber: i.invoiceNumber, financialYear: i.financialYear, issuedAt: i.issuedAt, ledgerEntryId: i.ledgerEntryId, snapshot: obj(i.snapshotJson), taxBreakdown: obj(i.taxBreakdownJson) });
const patchData = (p: RequestPatch): Prisma.V3ServiceRequestUncheckedUpdateManyInput => { const { attachmentRefs, ...rest } = p; return { ...rest, ...(attachmentRefs ? { attachmentRefs: attachmentRefs as Prisma.InputJsonValue } : {}) }; };
const OPEN: RequestStatus[] = ['REQUESTED', 'ACCEPTED', 'IN_PRODUCTION', 'READY_FOR_REVIEW', 'REVISION_REQUESTED'];

/** The request side of a unit of work on an OPEN transaction client. Every statement carries the vendor id. */
export function prismaRequestsTx(db: Prisma.TransactionClient, vendorId: string, audits: AuditService): RequestsTx {
  const termStart = async (): Promise<Date | null> => (await db.v3PlanSubscription.findUnique({ where: { currentVendorId: vendorId }, select: { startsAt: true } }))?.startsAt ?? null;
  return {
    insertRequest: async (d: NewRequest) => {
      try {
        return toRequest(await db.v3ServiceRequest.create({
          data: {
            id: d.id, vendorId: d.vendorId, serviceId: d.serviceId, status: d.status, briefJson: d.brief as Prisma.InputJsonValue, attachmentRefs: d.attachmentRefs as Prisma.InputJsonValue, priceSnapshotPaise: d.priceSnapshotPaise,
            taxSnapshotJson: d.taxSnapshot as Prisma.InputJsonValue, fundingKind: d.fundingKind, holdLedgerId: d.holdLedgerId, packPurchaseId: d.packPurchaseId, createdByType: d.createdByType, createdById: d.createdById, idempotencyKey: d.idempotencyKey,
          }, include: INCLUDE,
        }));
      } catch (e) { if (isUnique(e)) throw new DuplicateRequestError(); throw e; }
    },
    getRequest: async (id) => { const r = await db.v3ServiceRequest.findFirst({ where: { id, vendorId }, include: INCLUDE }); return r ? toRequest(r) : null; },
    findByKey: async (key) => { const r = await db.v3ServiceRequest.findUnique({ where: { vendorId_idempotencyKey: { vendorId, idempotencyKey: key } }, include: INCLUDE }); return r ? toRequest(r) : null; },
    updateRequestCas: async (id, expected, patch) => (await db.v3ServiceRequest.updateMany({ where: { id, vendorId, status: { in: expected } }, data: patchData(patch) })).count === 1,
    patchRequest: async (id, patch) => { await db.v3ServiceRequest.updateMany({ where: { id, vendorId }, data: patchData(patch) }); },
    insertEvent: async (d: NewEvent) => { await db.v3ServiceRequestEvent.create({ data: { requestId: d.requestId, vendorId: d.vendorId, type: d.type, fromStatus: d.fromStatus, toStatus: d.toStatus, actorType: d.actorType, actorId: d.actorId, note: d.note, metaJson: d.meta as Prisma.InputJsonValue, at: d.at } }); },
    events: async (requestId) => (await db.v3ServiceRequestEvent.findMany({ where: { requestId, vendorId }, orderBy: [{ at: 'asc' }, { id: 'asc' }] })).map(toEvent),
    insertDeliverable: async (d: NewDeliverable) => toDeliverable(await db.v3ServiceDeliverable.create({ data: { requestId: d.requestId, vendorId: d.vendorId, kind: d.kind, text: d.text, fileRef: d.fileRef, createdBy: d.createdBy, createdAt: d.createdAt } })),
    deliverables: async (requestId) => (await db.v3ServiceDeliverable.findMany({ where: { requestId, vendorId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })).map(toDeliverable),
    insertInvoice: async (d: NewInvoice) => toInvoice(await db.v3ServiceInvoice.create({ data: { vendorId: d.vendorId, requestId: d.requestId, invoiceNumber: d.invoiceNumber, financialYear: d.financialYear, issuedAt: d.issuedAt, ledgerEntryId: d.ledgerEntryId, snapshotJson: d.snapshot as Prisma.InputJsonValue, taxBreakdownJson: d.taxBreakdown as Prisma.InputJsonValue } })),
    invoiceFor: async (requestId) => { const i = await db.v3ServiceInvoice.findFirst({ where: { requestId, vendorId } }); return i ? toInvoice(i) : null; },
    allowanceUsed: async (serviceId) => { const since = await termStart(); return db.v3ServiceRequest.count({ where: { vendorId, serviceId, fundingKind: 'INCLUDED_ALLOWANCE', status: { notIn: ['CANCELLED', 'REJECTED_BY_TEAM'] }, ...(since ? { createdAt: { gte: since } } : {}) } }); },
    packReserved: async (serviceId) => db.v3ServiceRequest.count({ where: { vendorId, serviceId, fundingKind: 'PACK', status: { in: OPEN } } }),
    claimGrant: async (id) => (await db.v3ServiceRequest.updateMany({ where: { id, vendorId, grantOverrideId: null }, data: { grantOverrideId: 'PENDING' } })).count === 1,
    finishGrant: async (id, overrideId) => { await db.v3ServiceRequest.updateMany({ where: { id, vendorId }, data: { grantOverrideId: overrideId } }); },
    audit: (actor: Actor, action, entityId, before, after) => audits.record(db, actor, action, 'service_request', entityId, before, after),
  };
}

@Injectable()
export class PrismaRequestsStore extends RequestsStore {
  constructor(private readonly prisma: PrismaService, private readonly audits: AuditService, private readonly services: ServicesStore) { super(); }

  unit<T>(vendorId: string, fn: (r: RequestsTx, s: ServicesTx, w: WalletTx) => Promise<T>): Promise<T> {
    return this.services.withWallet(vendorId, (stx, wtx) => fn(prismaRequestsTx(wtx.db as Prisma.TransactionClient, vendorId, this.audits), stx, wtx));
  }
  async listForVendor(vendorId: string, skip: number, take: number) {
    const [rows, total] = await Promise.all([this.prisma.v3ServiceRequest.findMany({ where: { vendorId }, include: INCLUDE, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take }), this.prisma.v3ServiceRequest.count({ where: { vendorId } })]);
    return { items: rows.map(toRequest), total };
  }
  async getForVendor(vendorId: string, id: string) { const r = await this.prisma.v3ServiceRequest.findFirst({ where: { id, vendorId }, include: INCLUDE }); return r ? toRequest(r) : null; }
  async detail(requestId: string) {
    const [events, deliverables, invoice] = await Promise.all([
      this.prisma.v3ServiceRequestEvent.findMany({ where: { requestId }, orderBy: [{ at: 'asc' }, { id: 'asc' }] }), this.prisma.v3ServiceDeliverable.findMany({ where: { requestId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
      this.prisma.v3ServiceInvoice.findUnique({ where: { requestId } }),
    ]);
    return { events: events.map(toEvent), deliverables: deliverables.map(toDeliverable), invoice: invoice ? toInvoice(invoice) : null };
  }
  async invoicesForVendor(vendorId: string, skip: number, take: number) {
    const [rows, total] = await Promise.all([this.prisma.v3ServiceInvoice.findMany({ where: { vendorId }, orderBy: [{ issuedAt: 'desc' }, { id: 'asc' }], skip, take }), this.prisma.v3ServiceInvoice.count({ where: { vendorId } })]);
    return { items: rows.map(toInvoice), total };
  }
  async adminList(f: AdminRequestFilter) {
    const where: Prisma.V3ServiceRequestWhereInput = {
      ...(f.serviceKey ? { service: { key: f.serviceKey } } : {}), ...(f.status ? { status: f.status } : {}), ...(f.fundingKind ? { fundingKind: f.fundingKind } : {}), ...(f.vendorId ? { vendorId: f.vendorId } : {}),
      ...(f.slaBreached === true ? { OR: [{ slaBreachedAt: { not: null } }, { slaDueAt: { lt: f.now }, status: { in: ['REQUESTED', 'ACCEPTED', 'IN_PRODUCTION', 'REVISION_REQUESTED'] } }] } : {}),
    };
    const [rows, total] = await Promise.all([this.prisma.v3ServiceRequest.findMany({ where, include: INCLUDE, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], skip: f.skip, take: f.take }), this.prisma.v3ServiceRequest.count({ where })]);
    return { items: rows.map(toRequest), total };
  }
  async adminGet(id: string) { const r = await this.prisma.v3ServiceRequest.findUnique({ where: { id }, include: INCLUDE }); return r ? toRequest(r) : null; }
  async slaCandidates(now: Date, limit: number) {
    return (await this.prisma.v3ServiceRequest.findMany({ where: { slaDueAt: { lt: now }, slaBreachedAt: null, status: { in: ['REQUESTED', 'ACCEPTED', 'IN_PRODUCTION', 'REVISION_REQUESTED'] } }, include: INCLUDE, take: limit, orderBy: { slaDueAt: 'asc' } })).map(toRequest);
  }
  async autoApproveCandidates(readyBefore: Date, limit: number) {
    return (await this.prisma.v3ServiceRequest.findMany({ where: { status: 'READY_FOR_REVIEW', readyAt: { lte: readyBefore } }, include: INCLUDE, take: limit, orderBy: { readyAt: 'asc' } })).map(toRequest);
  }
  async allowanceUsedFor(vendorId: string, serviceKey: string) {
    const since = (await this.prisma.v3PlanSubscription.findUnique({ where: { currentVendorId: vendorId }, select: { startsAt: true } }))?.startsAt ?? null;
    return this.prisma.v3ServiceRequest.count({ where: { vendorId, service: { key: serviceKey }, fundingKind: 'INCLUDED_ALLOWANCE', status: { notIn: ['CANCELLED', 'REJECTED_BY_TEAM'] }, ...(since ? { createdAt: { gte: since } } : {}) } });
  }
}
