import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Actor, AuditService } from '../plans/admin/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletStore, WalletTx } from '../v3-wallet/wallet.store';
import { MarginKind, OrderStatus } from './core/registrar-core';
import {
  AccessAction, DocBlob, DuplicateOrderError, InvoiceRow, MarginDbRow, NewOrder, NewRegistered, OrderKind, OrderPatch, OrderRow, OtpRow, RegisteredPatch, RegisteredRow, RegistrantFields, RegistrantPatch, RegistrantRow,
  RegistrantStatus, RegistrarStore, RegistrarTx, RunRow,
} from './registrar.store';

const isUnique = (e: unknown): e is Prisma.PrismaClientKnownRequestError => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const nums = (v: unknown): number[] => (Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : []);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

const toOrder = (r: Prisma.V3DomainOrderGetPayload<Record<string, never>>): OrderRow => ({
  id: r.id, vendorId: r.vendorId, kind: r.kind as OrderKind, domain: r.domain, tld: r.tld, years: r.years, status: r.status as OrderStatus, registeredDomainId: r.registeredDomainId, amountPaise: r.amountPaise, costPaise: r.costPaise,
  marginPaise: r.marginPaise, privacyPaise: r.privacyPaise, taxSnapshot: obj(r.taxSnapshotJson), holdLedgerId: r.holdLedgerId, chargeLedgerId: r.chargeLedgerId, releaseLedgerId: r.releaseLedgerId, rcOrderId: r.rcOrderId,
  privacy: r.privacy, fundedBy: 'WALLET', requestedByType: r.requestedByType as OrderRow['requestedByType'], requestedById: r.requestedById, reason: r.reason, idempotencyKey: r.idempotencyKey, openKey: r.openKey,
  failureCode: r.failureCode, createdAt: r.createdAt, updatedAt: r.updatedAt,
});
const toRegistered = (r: Prisma.V3RegisteredDomainGetPayload<Record<string, never>>): RegisteredRow => ({
  id: r.id, vendorId: r.vendorId, domain: r.domain, tld: r.tld, rcOrderId: r.rcOrderId, status: r.status as RegisteredRow['status'], expiresAt: r.expiresAt, privacy: r.privacy, nameServers: strs(r.nameServers),
  dnsStatus: r.dnsStatus as RegisteredRow['dnsStatus'], alertsSent: nums(r.alertsSent), registeredAt: r.registeredAt, lastRenewedAt: r.lastRenewedAt,
});
const toInvoice = (r: Prisma.V3DomainInvoiceGetPayload<Record<string, never>>): InvoiceRow => ({ id: r.id, vendorId: r.vendorId, orderId: r.orderId, number: r.number, financialYear: r.financialYear, snapshot: obj(r.snapshotJson), totalPaise: r.totalPaise, issuedAt: r.issuedAt });
const toMargin = (r: Prisma.V3DomainMarginGetPayload<Record<string, never>>): MarginDbRow => ({ id: r.id, tld: r.tld, kind: r.kind as MarginKind, value: r.value, status: r.status as MarginDbRow['status'], effectiveFrom: r.effectiveFrom, note: r.note, createdBy: r.createdBy, approvedBy: r.approvedBy, approvedAt: r.approvedAt, createdAt: r.createdAt });
const toRegistrant = (r: Prisma.V3RegistrantGetPayload<Record<string, never>>): RegistrantRow => ({
  vendorId: r.vendorId, legalName: r.legalName, company: r.company, email: r.email, phoneCc: r.phoneCc, phone: r.phone, addressLine1: r.addressLine1, city: r.city, state: r.state, country: r.country, zipcode: r.zipcode,
  emailVerifiedAt: r.emailVerifiedAt, phoneVerifiedAt: r.phoneVerifiedAt, docKind: r.docKind, docLast4: r.docLast4, docMime: r.docMime, docBytes: r.docBytes, docUploadedAt: r.docUploadedAt, docPurgedAt: r.docPurgedAt,
  status: r.status as RegistrantStatus, reviewedBy: r.reviewedBy, reviewedAt: r.reviewedAt, reviewNote: r.reviewNote, consentAt: r.consentAt, updatedAt: r.updatedAt,
});
const toOtp = (r: Prisma.V3IdentityOtpGetPayload<Record<string, never>>): OtpRow => ({ id: r.id, vendorId: r.vendorId, channel: r.channel as OtpRow['channel'], toHash: r.toHash, codeHash: r.codeHash, expiresAt: r.expiresAt, attempts: r.attempts, consumedAt: r.consumedAt, createdAt: r.createdAt });
const toRun = (r: Prisma.V3RegistrarRunGetPayload<Record<string, never>>): RunRow => ({ id: r.id, startedAt: r.startedAt, finishedAt: r.finishedAt, checked: r.checked, settled: r.settled, mismatches: Array.isArray(r.mismatches) ? r.mismatches : [], balancePaise: r.balancePaise, status: r.status as RunRow['status'], note: r.note });
const UNSETTLED = ['CREATED', 'HELD', 'SUBMITTED', 'UNKNOWN'];

/** The registrar side of a unit of work on an OPEN transaction client. Every statement carries the vendor id. */
export function prismaRegistrarTx(db: Prisma.TransactionClient, vendorId: string, audits: AuditService): RegistrarTx {
  return {
    vendorId,
    orderByKey: async (key) => { const r = await db.v3DomainOrder.findUnique({ where: { vendorId_idempotencyKey: { vendorId, idempotencyKey: key } } }); return r ? toOrder(r) : null; },
    order: async (id) => { const r = await db.v3DomainOrder.findFirst({ where: { id, vendorId } }); return r ? toOrder(r) : null; },
    insertOrder: async (d: NewOrder) => {
      try {
        return toOrder(await db.v3DomainOrder.create({ data: {
          id: d.id, vendorId: d.vendorId, kind: d.kind, domain: d.domain, tld: d.tld, years: d.years, registeredDomainId: d.registeredDomainId, amountPaise: d.amountPaise, costPaise: d.costPaise, marginPaise: d.marginPaise, privacyPaise: d.privacyPaise,
          taxSnapshotJson: d.taxSnapshot as Prisma.InputJsonValue, privacy: d.privacy, requestedByType: d.requestedByType, requestedById: d.requestedById, reason: d.reason, idempotencyKey: d.idempotencyKey, openKey: d.openKey,
        } }));
      } catch (e) { if (isUnique(e)) throw new DuplicateOrderError(String(e.meta?.target ?? '').includes('openKey') ? 'NAME' : 'KEY'); throw e; }
    },
    updateOrder: async (id, expected: OrderStatus[], patch: OrderPatch) => {
      const done = await db.v3DomainOrder.updateMany({ where: { id, vendorId, status: { in: expected } }, data: { ...patch } });
      if (done.count !== 1) return null;
      const r = await db.v3DomainOrder.findFirst({ where: { id, vendorId } }); return r ? toOrder(r) : null;
    },
    registeredByDomain: async (domain) => { const r = await db.v3RegisteredDomain.findFirst({ where: { domain, vendorId } }); return r ? toRegistered(r) : null; },
    registered: async (id) => { const r = await db.v3RegisteredDomain.findFirst({ where: { id, vendorId } }); return r ? toRegistered(r) : null; },
    insertRegistered: async (d: NewRegistered) => toRegistered(await db.v3RegisteredDomain.create({ data: { vendorId: d.vendorId, domain: d.domain, tld: d.tld, rcOrderId: d.rcOrderId, expiresAt: d.expiresAt, privacy: d.privacy, nameServers: d.nameServers as Prisma.InputJsonValue } })),
    updateRegistered: async (id, patch: RegisteredPatch) => {
      const { nameServers, alertsSent, ...rest } = patch;
      const done = await db.v3RegisteredDomain.updateMany({ where: { id, vendorId }, data: { ...rest, ...(nameServers ? { nameServers: nameServers as Prisma.InputJsonValue } : {}), ...(alertsSent ? { alertsSent: alertsSent as Prisma.InputJsonValue } : {}) } });
      if (done.count !== 1) return null;
      const r = await db.v3RegisteredDomain.findFirst({ where: { id, vendorId } }); return r ? toRegistered(r) : null;
    },
    adoptDomain: async (host, now) => {
      const ex = await db.v3Domain.findUnique({ where: { hostname: host } });
      if (ex) {
        if (ex.vendorId !== vendorId) return null;
        if (ex.status === 'REMOVED') await db.v3Domain.updateMany({ where: { id: ex.id, vendorId }, data: { status: 'ACTIVE', verifiedAt: now, removedAt: null, kind: 'CUSTOM' } });
        return ex.id;
      }
      return (await db.v3Domain.create({ data: { vendorId, hostname: host, kind: 'CUSTOM', status: 'ACTIVE', verifiedAt: now, createdByType: 'SYSTEM' } })).id;
    },
    customer: async () => { const r = await db.v3RegistrarCustomer.findFirst({ where: { vendorId } }); return r ? { rcCustomerId: r.rcCustomerId, rcContactId: r.rcContactId } : null; },
    invoiceForOrder: async (orderId) => { const r = await db.v3DomainInvoice.findFirst({ where: { orderId, vendorId } }); return r ? toInvoice(r) : null; },
    insertInvoice: async (d) => toInvoice(await db.v3DomainInvoice.create({ data: { vendorId: d.vendorId, orderId: d.orderId, number: d.number, financialYear: d.financialYear, snapshotJson: d.snapshot as Prisma.InputJsonValue, totalPaise: d.totalPaise, issuedAt: d.issuedAt } })),
    audit: (actor: Actor, action, entityId, before, after) => audits.record(db, actor, action, 'domain_order', entityId, before, after),
  };
}

@Injectable()
export class PrismaRegistrarStore extends RegistrarStore {
  constructor(private readonly prisma: PrismaService, private readonly wallets: WalletStore, private readonly audits: AuditService) { super(); }
  unit<T>(vendorId: string, fn: (t: RegistrarTx, w: WalletTx) => Promise<T>): Promise<T> { return this.wallets.unit(vendorId, (wtx) => fn(prismaRegistrarTx(wtx.db as Prisma.TransactionClient, vendorId, this.audits), wtx)); }

  // price book (platform wide: no vendor)
  async margins() { return (await this.prisma.v3DomainMargin.findMany({ orderBy: [{ tld: 'asc' }, { effectiveFrom: 'desc' }] })).map(toMargin); }
  async getMargin(id: string) { const r = await this.prisma.v3DomainMargin.findUnique({ where: { id } }); return r ? toMargin(r) : null; }
  async insertMargin(d: Pick<MarginDbRow, 'tld' | 'kind' | 'value' | 'note' | 'createdBy'>) { return toMargin(await this.prisma.v3DomainMargin.create({ data: d })); }
  async updateMargin(id: string, expected: MarginDbRow['status'][], patch: Partial<Pick<MarginDbRow, 'status' | 'effectiveFrom' | 'approvedBy' | 'approvedAt'>>) {
    try {
      const done = await this.prisma.v3DomainMargin.updateMany({ where: { id, status: { in: expected } }, data: { ...patch } });
      return done.count === 1 ? this.getMargin(id) : null;
    } catch (e) { if (isUnique(e)) return null; throw e; }
  }

  // registrant and identity
  async registrant(vendorId: string) { const r = await this.prisma.v3Registrant.findFirst({ where: { vendorId } }); return r ? toRegistrant(r) : null; }
  async saveRegistrant(vendorId: string, f: RegistrantFields, resetEmail: boolean, resetPhone: boolean) {
    const reset = { ...(resetEmail ? { emailVerifiedAt: null } : {}), ...(resetPhone ? { phoneVerifiedAt: null } : {}) };
    return toRegistrant(await this.prisma.v3Registrant.upsert({ where: { vendorId }, create: { vendorId, ...f }, update: { ...f, ...reset } }));
  }
  async patchRegistrant(vendorId: string, expected: RegistrantStatus[] | null, patch: RegistrantPatch) {
    const done = await this.prisma.v3Registrant.updateMany({ where: { vendorId, ...(expected ? { status: { in: expected } } : {}) }, data: { ...patch } });
    return done.count === 1 ? this.registrant(vendorId) : null;
  }
  async storeDocument(vendorId: string, blob: DocBlob, meta: { kind: string; last4: string | null; mime: string; bytes: number; at: Date }) {
    const done = await this.prisma.v3Registrant.updateMany({ where: { vendorId }, data: { docCipher: new Uint8Array(blob.cipher), docIv: new Uint8Array(blob.iv), docTag: new Uint8Array(blob.tag), docKind: meta.kind, docLast4: meta.last4, docMime: meta.mime, docBytes: meta.bytes, docUploadedAt: meta.at, docPurgedAt: null } });
    return done.count === 1 ? this.registrant(vendorId) : null;
  }
  async readDocument(vendorId: string) {
    const r = await this.prisma.v3Registrant.findFirst({ where: { vendorId }, select: { docCipher: true, docIv: true, docTag: true, docMime: true, docKind: true } });
    return r && r.docCipher && r.docIv && r.docTag && r.docMime && r.docKind ? { cipher: Buffer.from(r.docCipher), iv: Buffer.from(r.docIv), tag: Buffer.from(r.docTag), mime: r.docMime, kind: r.docKind } : null;
  }
  async purgeDocument(vendorId: string, at: Date) { return (await this.prisma.v3Registrant.updateMany({ where: { vendorId, docCipher: { not: null } }, data: { docCipher: null, docIv: null, docTag: null, docPurgedAt: at } })).count === 1; }
  async insertOtp(d: Omit<OtpRow, 'id' | 'attempts' | 'consumedAt' | 'createdAt'> & { createdAt: Date }) { return toOtp(await this.prisma.v3IdentityOtp.create({ data: { vendorId: d.vendorId, channel: d.channel, toHash: d.toHash, codeHash: d.codeHash, expiresAt: d.expiresAt, createdAt: d.createdAt } })); }
  async latestOtp(vendorId: string, channel: 'EMAIL' | 'PHONE') { const r = await this.prisma.v3IdentityOtp.findFirst({ where: { vendorId, channel }, orderBy: { createdAt: 'desc' } }); return r ? toOtp(r) : null; }
  async updateOtp(vendorId: string, id: string, patch: { attempts?: number; consumedAt?: Date }) { await this.prisma.v3IdentityOtp.updateMany({ where: { id, vendorId }, data: { ...patch } }); }
  async logAccess(vendorId: string, staffId: string | null, action: AccessAction, reason: string | null, at: Date) { await this.prisma.v3IdentityAccess.create({ data: { vendorId, staffId, action, reason, at } }); }
  async accessLog(vendorId: string, skip: number, take: number) {
    const [items, total] = await Promise.all([this.prisma.v3IdentityAccess.findMany({ where: { vendorId }, orderBy: [{ at: 'desc' }, { id: 'desc' }], skip, take }), this.prisma.v3IdentityAccess.count({ where: { vendorId } })]);
    return { items: items.map((r) => ({ staffId: r.staffId, action: r.action, reason: r.reason, at: r.at })), total };
  }
  async reviewQueue(status: RegistrantStatus | undefined, skip: number, take: number) {
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([this.prisma.v3Registrant.findMany({ where, orderBy: { updatedAt: 'asc' }, skip, take }), this.prisma.v3Registrant.count({ where })]);
    return { items: items.map(toRegistrant), total };
  }
  async documentsDueForPurge(decidedBefore: Date, limit: number) { return (await this.prisma.v3Registrant.findMany({ where: { status: { in: ['APPROVED', 'REJECTED'] }, reviewedAt: { lt: decidedBefore }, docCipher: { not: null } }, select: { vendorId: true }, take: limit })).map((r) => r.vendorId); }

  // customer, orders, registered domains
  async customer(vendorId: string) { const r = await this.prisma.v3RegistrarCustomer.findFirst({ where: { vendorId } }); return r ? { rcCustomerId: r.rcCustomerId, rcContactId: r.rcContactId } : null; }
  async saveCustomer(vendorId: string, rcCustomerId: string, rcContactId: string) {
    const r = await this.prisma.v3RegistrarCustomer.upsert({ where: { vendorId }, create: { vendorId, rcCustomerId, rcContactId }, update: {} });   // a second writer keeps the first one's ids
    return { rcCustomerId: r.rcCustomerId, rcContactId: r.rcContactId };
  }
  async orderByKey(vendorId: string, key: string) { const r = await this.prisma.v3DomainOrder.findUnique({ where: { vendorId_idempotencyKey: { vendorId, idempotencyKey: key } } }); return r ? toOrder(r) : null; }
  async order(vendorId: string, id: string) { const r = await this.prisma.v3DomainOrder.findFirst({ where: { id, vendorId } }); return r ? toOrder(r) : null; }
  async ordersForVendor(vendorId: string, skip: number, take: number) {
    const [items, total] = await Promise.all([this.prisma.v3DomainOrder.findMany({ where: { vendorId }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take }), this.prisma.v3DomainOrder.count({ where: { vendorId } })]);
    return { items: items.map(toOrder), total };
  }
  async ordersForStaff(f: { vendorId?: string; status?: OrderStatus; kind?: OrderKind }, skip: number, take: number) {
    const where = { ...(f.vendorId ? { vendorId: f.vendorId } : {}), ...(f.status ? { status: f.status } : {}), ...(f.kind ? { kind: f.kind } : {}) };
    const [items, total] = await Promise.all([this.prisma.v3DomainOrder.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take }), this.prisma.v3DomainOrder.count({ where })]);
    return { items: items.map(toOrder), total };
  }
  async unsettledOrders(before: Date, limit: number) { return (await this.prisma.v3DomainOrder.findMany({ where: { status: { in: UNSETTLED }, updatedAt: { lte: before } }, orderBy: { updatedAt: 'asc' }, take: limit })).map(toOrder); }
  async registeredForVendor(vendorId: string) { return (await this.prisma.v3RegisteredDomain.findMany({ where: { vendorId }, orderBy: { domain: 'asc' } })).map(toRegistered); }
  async registeredOne(vendorId: string, id: string) { const r = await this.prisma.v3RegisteredDomain.findFirst({ where: { id, vendorId } }); return r ? toRegistered(r) : null; }
  async registeredByName(domain: string) { const r = await this.prisma.v3RegisteredDomain.findUnique({ where: { domain } }); return r ? toRegistered(r) : null; }
  async activeRegistered(limit: number) { return (await this.prisma.v3RegisteredDomain.findMany({ where: { status: 'ACTIVE' }, orderBy: { expiresAt: 'asc' }, take: limit })).map(toRegistered); }
  async patchRegistered(vendorId: string, id: string, patch: RegisteredPatch) {
    const { nameServers, alertsSent, ...rest } = patch;
    const done = await this.prisma.v3RegisteredDomain.updateMany({ where: { id, vendorId }, data: { ...rest, ...(nameServers ? { nameServers: nameServers as Prisma.InputJsonValue } : {}), ...(alertsSent ? { alertsSent: alertsSent as Prisma.InputJsonValue } : {}) } });
    return done.count === 1 ? this.registeredOne(vendorId, id) : null;
  }
  async invoiceForOrder(vendorId: string, orderId: string) { const r = await this.prisma.v3DomainInvoice.findFirst({ where: { orderId, vendorId } }); return r ? toInvoice(r) : null; }

  // runs (platform wide)
  async insertRun(at: Date) { return toRun(await this.prisma.v3RegistrarRun.create({ data: { startedAt: at } })); }
  async finishRun(id: string, patch: Partial<Pick<RunRow, 'finishedAt' | 'checked' | 'settled' | 'mismatches' | 'balancePaise' | 'status' | 'note'>>) {
    const { mismatches, ...rest } = patch;
    await this.prisma.v3RegistrarRun.update({ where: { id }, data: { ...rest, ...(mismatches ? { mismatches: mismatches as Prisma.InputJsonValue } : {}) } });
  }
  async lastRuns(take: number) { return (await this.prisma.v3RegistrarRun.findMany({ orderBy: { startedAt: 'desc' }, take })).map(toRun); }
}
