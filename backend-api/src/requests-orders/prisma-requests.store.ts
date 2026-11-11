import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { KeyedQueue } from '../common/keyed-queue';
import { Actor, AuditService } from '../plans/admin/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { MethodKind, MethodStatus, formatInvoiceNumber } from './core/commerce-core';
import { Channel } from './core/messaging-core';
import { RequestKind, RequestStatus } from './core/requests-core';
import {
  BlockRow, EventRow, InvoiceRow, MethodRow, MethodSecrets, NewEvent, NewOrder, NewRequest, OfferRow, OfferUsedUp, OrderItemRow, OrderRow, OrderStatus, OutboxRow, ReportRow, RequestFilter, RequestRow,
  RequestsStore, SealedBox, StockUnavailable,
} from './requests.store';

type Tx = Prisma.TransactionClient;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const toReq = (r: Prisma.V3RequestGetPayload<object>): RequestRow => ({
  id: r.id, vendorId: r.vendorId, siteHost: r.siteHost, kind: r.kind as RequestKind, status: r.status as RequestStatus, customerName: r.customerName, customerPhoneE164: r.customerPhoneE164, customerEmail: r.customerEmail,
  payload: obj(r.payloadJson), sourceKind: r.sourceKind, directoryRefHash: r.directoryRefHash, utmSource: r.utmSource, utmMedium: r.utmMedium, utmCampaign: r.utmCampaign, idempotencyKey: r.idempotencyKey,
  spamScore: r.spamScore, firstSeenAt: r.firstSeenAt, firstResponseAt: r.firstResponseAt, expiresAt: r.expiresAt, convertedCustomerId: r.convertedCustomerId, convertedBookingId: r.convertedBookingId, createdAt: r.createdAt, updatedAt: r.updatedAt,
});
const toEv = (e: Prisma.V3RequestEventGetPayload<object>): EventRow => ({ id: e.id, requestId: e.requestId, type: e.type, actorType: e.actorType, channel: e.channel, deliveryResult: e.deliveryResult, at: e.at, meta: obj(e.metaJson) });
const toMethod = (m: Prisma.V3VendorPaymentMethodGetPayload<object>): MethodRow => ({
  id: m.id, vendorId: m.vendorId, kind: m.kind as MethodKind, label: m.label, last4: m.last4, upiId: m.upiId, payeeName: m.payeeName, isDefault: m.isDefault, showToCustomers: m.showToCustomers, hasSecret: !!m.configCipher, hasWebhookSecret: !!m.webhookSecretCipher, status: m.status as MethodStatus, verifiedAt: m.verifiedAt, createdAt: m.createdAt, updatedAt: m.updatedAt,
});
const toOrder = (o: Prisma.V3OrderGetPayload<object>): OrderRow => ({
  id: o.id, vendorId: o.vendorId, requestId: o.requestId, orderNo: o.orderNo, status: o.status, paymentMode: o.paymentMode, methodId: o.methodId, amountPaise: o.amountPaise, currency: o.currency, reviewFlag: o.reviewFlag,
  shipping: obj(o.shippingJson), tracking: obj(o.trackingJson), refundedPaise: o.refundedPaise, paidAt: o.paidAt, createdAt: o.createdAt, updatedAt: o.updatedAt,
});
const toItem = (i: Prisma.V3OrderItemGetPayload<object>): OrderItemRow => ({ id: i.id, orderId: i.orderId, productRef: i.productRef, name: i.name, qty: i.qty, unitPaise: i.unitPaise, tax: obj(i.taxJson) });
const toInv = (i: Prisma.V3VendorInvoiceGetPayload<object>): InvoiceRow => ({ id: i.id, vendorId: i.vendorId, orderId: i.orderId, requestId: i.requestId, seq: i.seq, invoiceNumber: i.invoiceNumber, issuedAt: i.issuedAt, snapshot: obj(i.snapshotJson), status: i.status, voidedAt: i.voidedAt, voidReason: i.voidReason });
const toOffer = (o: Prisma.V3OfferGetPayload<object>): OfferRow => ({ id: o.id, vendorId: o.vendorId, kind: o.kind, title: o.title, code: o.code, percentOff: o.percentOff, flatPaise: o.flatPaise, minOrderPaise: o.minOrderPaise, startsAt: o.startsAt, endsAt: o.endsAt, usageLimit: o.usageLimit, usedCount: o.usedCount, status: o.status, createdAt: o.createdAt, updatedAt: o.updatedAt });
const toMsg = (m: Prisma.V3MessageOutboxGetPayload<object>): OutboxRow => ({ id: m.id, vendorId: m.vendorId, channel: m.channel, templateKey: m.templateKey, toHash: m.toHash, toMasked: m.toMasked, payload: obj(m.payloadRedactedJson), senderRoute: m.senderRoute, status: m.status, attempts: m.attempts, relatedRequestId: m.relatedRequestId, createdAt: m.createdAt });

/** Prisma implementation. Every vendor-owned read and write carries the vendor id. The per-vendor wait is in the KeyedQueue BEFORE a transaction opens (batch rule c). */
@Injectable()
export class PrismaRequestsStore extends RequestsStore {
  private readonly queue = new KeyedQueue();
  constructor(private readonly prisma: PrismaService, private readonly audits: AuditService) { super(); }

  private async nextNumber(tx: Tx, vendorId: string, kind: 'ORDER' | 'INVOICE'): Promise<number> {
    // one atomic statement: the row is created at 1 or incremented, and the new value comes back; parallel callers get different numbers and there is never a gap
    const rows = await tx.$queryRaw<Array<{ value: number }>>`INSERT INTO "g4d_vendor_counters" ("id", "vendorId", "kind", "value") VALUES (${`vc_${vendorId}_${kind}`}, ${vendorId}, ${kind}::"V3CounterKind", 1)
      ON CONFLICT ("vendorId", "kind") DO UPDATE SET "value" = "g4d_vendor_counters"."value" + 1 RETURNING "value"`;
    return Number(rows[0].value);
  }

  private async insertRequest(tx: Tx, r: NewRequest): Promise<Prisma.V3RequestGetPayload<object>> {
    const row = await tx.v3Request.create({
      data: {
        vendorId: r.vendorId, siteHost: r.siteHost, kind: r.kind, status: r.status, customerName: r.customerName, customerPhoneE164: r.customerPhoneE164, customerEmail: r.customerEmail, payloadJson: r.payload as Prisma.InputJsonValue,
        sourceKind: r.sourceKind, directoryRefHash: r.directoryRefHash, utmSource: r.utmSource, utmMedium: r.utmMedium, utmCampaign: r.utmCampaign, idempotencyKey: r.idempotencyKey, spamScore: r.spamScore, expiresAt: r.expiresAt,
        consent: { create: { textVersion: r.consent.textVersion, textHash: r.consent.textHash, ipHash: r.consent.ipHash, contactByBusiness: r.consent.contactByBusiness, contactByPlatform: r.consent.contactByPlatform, marketing: r.consent.marketing } },
        ...(r.trackingTokenHash && r.trackingExpiresAt ? { tracking: { create: { tokenHash: r.trackingTokenHash, expiresAt: r.trackingExpiresAt } } } : {}),
        events: { create: r.events.map((e) => ({ type: e.type, actorType: e.actorType, channel: e.channel ?? null, deliveryResult: e.deliveryResult ?? null, metaJson: (e.meta ?? {}) as Prisma.InputJsonValue })) },
      },
    });
    return row;
  }

  // ── requests ──
  async findByIdempotency(vendorId: string, key: string) { const r = await this.prisma.v3Request.findUnique({ where: { vendorId_idempotencyKey: { vendorId, idempotencyKey: key } } }); return r ? toReq(r) : null; }
  async createRequest(r: NewRequest) { return toReq(await this.prisma.$transaction((tx) => this.insertRequest(tx, r))); }
  async getRequest(id: string, vendorId?: string) { const r = await this.prisma.v3Request.findFirst({ where: { id, ...(vendorId ? { vendorId } : {}) } }); return r ? toReq(r) : null; }
  async listRequests(vendorId: string | null, f: RequestFilter) {
    const where: Prisma.V3RequestWhereInput = {
      ...(vendorId ? { vendorId } : {}), ...(f.status ? { status: f.status } : {}), ...(f.kind ? { kind: f.kind } : {}), ...(f.q ? { customerName: { contains: f.q, mode: 'insensitive' } } : {}),
      ...(f.from || f.to ? { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } } : {}),
    };
    const [items, total] = await Promise.all([this.prisma.v3Request.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: f.skip, take: f.take }), this.prisma.v3Request.count({ where })]);
    return { items: items.map(toReq), total };
  }
  async transition(id: string, from: RequestStatus, to: RequestStatus, patch: { firstSeenAt?: Date; firstResponseAt?: Date }, event: NewEvent) {
    return this.prisma.$transaction(async (tx) => {
      const cur = await tx.v3Request.findUnique({ where: { id }, select: { firstSeenAt: true, firstResponseAt: true } });
      const res = await tx.v3Request.updateMany({ where: { id, status: from }, data: { status: to, ...(patch.firstSeenAt && !cur?.firstSeenAt ? { firstSeenAt: patch.firstSeenAt } : {}), ...(patch.firstResponseAt && !cur?.firstResponseAt ? { firstResponseAt: patch.firstResponseAt } : {}) } });
      if (res.count !== 1) return null;
      await tx.v3RequestEvent.create({ data: { requestId: id, type: event.type, actorType: event.actorType, channel: event.channel ?? null, deliveryResult: event.deliveryResult ?? null, metaJson: (event.meta ?? {}) as Prisma.InputJsonValue } });
      return toReq(await tx.v3Request.findUniqueOrThrow({ where: { id } }));
    });
  }
  async addEvent(requestId: string, e: NewEvent, at: Date) { await this.prisma.v3RequestEvent.create({ data: { requestId, type: e.type, actorType: e.actorType, channel: e.channel ?? null, deliveryResult: e.deliveryResult ?? null, at, metaJson: (e.meta ?? {}) as Prisma.InputJsonValue } }); }
  async events(requestId: string) { return (await this.prisma.v3RequestEvent.findMany({ where: { requestId }, orderBy: { at: 'asc' }, take: 500 })).map(toEv); }
  async setLinks(id: string, vendorId: string, links: { customerId?: string; bookingId?: string }) {
    const res = await this.prisma.v3Request.updateMany({ where: { id, vendorId }, data: { ...(links.customerId ? { convertedCustomerId: links.customerId } : {}), ...(links.bookingId ? { convertedBookingId: links.bookingId } : {}) } });
    return res.count === 1 ? this.getRequest(id, vendorId) : null;
  }
  async trackingByHash(hash: string) { const t = await this.prisma.v3RequestTracking.findUnique({ where: { tokenHash: hash }, include: { request: true } }); return t ? { request: toReq(t.request), expiresAt: t.expiresAt } : null; }
  async countRecentByPhone(vendorId: string, phone: string, since: Date) { return this.prisma.v3Request.count({ where: { vendorId, customerPhoneE164: phone, createdAt: { gte: since } } }); }
  async countRecentByIp(ipHash: string, since: Date) { return this.prisma.v3RequestConsent.count({ where: { ipHash, at: { gte: since } } }); }
  async findRecentDuplicate(vendorId: string, phone: string, kind: RequestKind, payload: Record<string, unknown>, since: Date) {
    const r = await this.prisma.v3Request.findFirst({ where: { vendorId, customerPhoneE164: phone, kind, createdAt: { gte: since }, payloadJson: { equals: payload as Prisma.InputJsonValue } } });
    return r ? toReq(r) : null;
  }
  async expirable(now: Date, limit: number) { return (await this.prisma.v3Request.findMany({ where: { status: { in: ['RECEIVED', 'DELIVERED', 'SEEN'] }, expiresAt: { lte: now } }, take: limit })).map(toReq); }
  async nudgeCandidates(before: Date, limit: number) { return (await this.prisma.v3Request.findMany({ where: { status: { in: ['RECEIVED', 'DELIVERED', 'SEEN'] }, firstResponseAt: null, createdAt: { lte: before } }, orderBy: { createdAt: 'asc' }, take: limit })).map(toReq); }

  // ── payment methods ──
  async createMethod(d: { vendorId: string; kind: MethodKind; label: string; last4: string | null; config: SealedBox; webhook: SealedBox; upiId?: string | null; payeeName?: string | null; showToCustomers?: boolean }) {
    return toMethod(await this.prisma.v3VendorPaymentMethod.create({ data: { vendorId: d.vendorId, kind: d.kind, label: d.label, last4: d.last4, upiId: d.upiId ?? null, payeeName: d.payeeName ?? null, showToCustomers: d.showToCustomers ?? false, configCipher: d.config.cipher, configIv: d.config.iv, configTag: d.config.tag, webhookSecretCipher: d.webhook.cipher, webhookSecretIv: d.webhook.iv, webhookSecretTag: d.webhook.tag } }));
  }
  async listMethods(vendorId: string) { return (await this.prisma.v3VendorPaymentMethod.findMany({ where: { vendorId }, orderBy: { createdAt: 'asc' } })).map(toMethod); }
  async getMethod(id: string, vendorId?: string) { const m = await this.prisma.v3VendorPaymentMethod.findFirst({ where: { id, ...(vendorId ? { vendorId } : {}) } }); return m ? toMethod(m) : null; }
  async methodSecrets(id: string, vendorId: string): Promise<MethodSecrets | null> {
    const m = await this.prisma.v3VendorPaymentMethod.findFirst({ where: { id, vendorId } });
    return m ? { config: { cipher: m.configCipher, iv: m.configIv, tag: m.configTag }, webhook: { cipher: m.webhookSecretCipher, iv: m.webhookSecretIv, tag: m.webhookSecretTag } } : null;
  }
  async updateMethod(id: string, vendorId: string, p: { label?: string; status?: MethodStatus; verifiedAt?: Date | null; last4?: string | null; config?: SealedBox; webhook?: SealedBox; upiId?: string | null; payeeName?: string | null; showToCustomers?: boolean; isDefault?: boolean }) {
    const data: Prisma.V3VendorPaymentMethodUpdateManyMutationInput = {
      ...(p.label !== undefined ? { label: p.label } : {}), ...(p.status !== undefined ? { status: p.status } : {}), ...(p.verifiedAt !== undefined ? { verifiedAt: p.verifiedAt } : {}), ...(p.last4 !== undefined ? { last4: p.last4 } : {}),
      ...(p.upiId !== undefined ? { upiId: p.upiId } : {}), ...(p.payeeName !== undefined ? { payeeName: p.payeeName } : {}), ...(p.showToCustomers !== undefined ? { showToCustomers: p.showToCustomers } : {}), ...(p.isDefault !== undefined ? { isDefault: p.isDefault } : {}),
      ...(p.config ? { configCipher: p.config.cipher, configIv: p.config.iv, configTag: p.config.tag } : {}), ...(p.webhook ? { webhookSecretCipher: p.webhook.cipher, webhookSecretIv: p.webhook.iv, webhookSecretTag: p.webhook.tag } : {}),
    };
    const res = await this.prisma.v3VendorPaymentMethod.updateMany({ where: { id, vendorId }, data });
    return res.count === 1 ? this.getMethod(id, vendorId) : null;
  }
  async setDefaultMethod(id: string, vendorId: string) {
    return this.prisma.$transaction(async (tx) => {
      if (!(await tx.v3VendorPaymentMethod.findFirst({ where: { id, vendorId }, select: { id: true } }))) return null;
      await tx.v3VendorPaymentMethod.updateMany({ where: { vendorId, isDefault: true, NOT: { id } }, data: { isDefault: false } });
      await tx.v3VendorPaymentMethod.updateMany({ where: { id, vendorId }, data: { isDefault: true } });
      const m = await tx.v3VendorPaymentMethod.findFirst({ where: { id, vendorId } }); return m ? toMethod(m) : null;
    });
  }

  // ── orders ──
  async placeOrder(o: NewOrder) {
    const vendorId = o.request.vendorId;
    return this.queue.run(`orders:${vendorId}`, () => this.prisma.$transaction(async (tx) => {
      for (const it of o.items) {
        const lvl = await tx.v3StockLevel.findUnique({ where: { vendorId_productRef: { vendorId, productRef: it.productRef } } });
        if (!lvl) continue;   // not tracked: unlimited
        const res = await tx.$executeRaw`UPDATE "g4d_stock_levels" SET "reserved" = "reserved" + ${it.qty}, "updatedAt" = NOW() WHERE "vendorId" = ${vendorId} AND "productRef" = ${it.productRef} AND "onHand" - "reserved" >= ${it.qty}`;
        if (res !== 1) throw new StockUnavailable(it.productRef);
      }
      if (o.offerId) {
        const res = await tx.$executeRaw`UPDATE "g4d_offers" SET "usedCount" = "usedCount" + 1, "updatedAt" = NOW() WHERE "id" = ${o.offerId} AND "vendorId" = ${vendorId} AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
        if (res !== 1) throw new OfferUsedUp();
      }
      const request = await this.insertRequest(tx, o.request);
      const orderNo = await this.nextNumber(tx, vendorId, 'ORDER');
      const order = await tx.v3Order.create({
        data: { vendorId, requestId: request.id, orderNo, status: o.paymentMode === 'ONLINE' ? 'AWAITING_PAYMENT' : 'PLACED', paymentMode: o.paymentMode, methodId: o.methodId, amountPaise: o.amountPaise, currency: o.currency, shippingJson: o.shipping as Prisma.InputJsonValue,
          items: { create: o.items.map((i) => ({ productRef: i.productRef, name: i.name, qty: i.qty, unitPaise: i.unitPaise, taxJson: i.tax as Prisma.InputJsonValue })) } },
        include: { items: true },
      });
      for (const it of o.items) {
        if (await tx.v3StockLevel.findUnique({ where: { vendorId_productRef: { vendorId, productRef: it.productRef } }, select: { id: true } })) {
          await tx.v3StockReservation.create({ data: { vendorId, orderId: order.id, productRef: it.productRef, qty: it.qty, expiresAt: o.reserveUntil } });
        }
      }
      return { order: toOrder(order), request: toReq(request), items: order.items.map(toItem) };
    }, { maxWait: 15_000 }));
  }
  async getOrder(id: string, vendorId?: string) { const o = await this.prisma.v3Order.findFirst({ where: { id, ...(vendorId ? { vendorId } : {}) }, include: { items: true } }); return o ? { order: toOrder(o), items: o.items.map(toItem) } : null; }
  async orderByRequest(requestId: string) { const o = await this.prisma.v3Order.findUnique({ where: { requestId }, include: { items: true } }); return o ? { order: toOrder(o), items: o.items.map(toItem) } : null; }
  async listOrders(vendorId: string, f: { status?: OrderStatus; skip: number; take: number }) {
    const where: Prisma.V3OrderWhereInput = { vendorId, ...(f.status ? { status: f.status } : {}) };
    const [items, total] = await Promise.all([this.prisma.v3Order.findMany({ where, orderBy: { orderNo: 'desc' }, skip: f.skip, take: f.take }), this.prisma.v3Order.count({ where })]);
    return { items: items.map(toOrder), total };
  }
  async moveOrder(id: string, vendorId: string, from: OrderStatus, to: OrderStatus, patch: { tracking?: Record<string, unknown> }) {
    const res = await this.prisma.v3Order.updateMany({ where: { id, vendorId, status: from }, data: { status: to, ...(patch.tracking ? { trackingJson: patch.tracking as Prisma.InputJsonValue } : {}) } });
    return res.count === 1 ? toOrder(await this.prisma.v3Order.findUniqueOrThrow({ where: { id } })) : null;
  }
  async markPaid(orderId: string, vendorId: string, now: Date) {
    return this.queue.run(`orders:${vendorId}`, () => this.prisma.$transaction(async (tx) => {
      const res = await tx.v3Order.updateMany({ where: { id: orderId, vendorId, status: { in: ['PLACED', 'AWAITING_PAYMENT'] } }, data: { status: 'PAID', paidAt: now } });
      const order = await tx.v3Order.findUniqueOrThrow({ where: { id: orderId } });
      if (res.count !== 1) return { order: toOrder(order), alreadyPaid: true, invoice: null };   // exactly once: a second delivery changes nothing
      for (const r of await tx.v3StockReservation.findMany({ where: { orderId, releasedAt: null, committedAt: null } })) {
        await tx.$executeRaw`UPDATE "g4d_stock_levels" SET "onHand" = "onHand" - ${r.qty}, "reserved" = "reserved" - ${r.qty}, "updatedAt" = NOW() WHERE "vendorId" = ${vendorId} AND "productRef" = ${r.productRef}`;
        await tx.v3StockReservation.update({ where: { id: r.id }, data: { committedAt: now } });
      }
      const seq = await this.nextNumber(tx, vendorId, 'INVOICE');
      const inv = await tx.v3VendorInvoice.create({ data: { vendorId, orderId, requestId: order.requestId, seq, invoiceNumber: formatInvoiceNumber('INV-', seq), issuedAt: now, snapshotJson: { orderNo: order.orderNo, amountPaise: order.amountPaise, currency: order.currency } } });
      return { order: toOrder(order), alreadyPaid: false, invoice: toInv(inv) };
    }, { maxWait: 15_000 }));
  }
  async flagReview(orderId: string, vendorId: string) { await this.prisma.v3Order.updateMany({ where: { id: orderId, vendorId }, data: { reviewFlag: true } }); }
  async recordRefund(orderId: string, vendorId: string, amountPaise: number) {
    const res = await this.prisma.v3Order.updateMany({ where: { id: orderId, vendorId }, data: { refundedPaise: { increment: amountPaise } } });
    if (res.count !== 1) return null;
    const o = await this.prisma.v3Order.findUniqueOrThrow({ where: { id: orderId } });
    if (o.refundedPaise >= o.amountPaise && o.status !== 'REFUNDED_RECORDED') await this.prisma.v3Order.update({ where: { id: orderId }, data: { status: 'REFUNDED_RECORDED' } });
    return toOrder(await this.prisma.v3Order.findUniqueOrThrow({ where: { id: orderId } }));
  }
  async recordPaymentEvent(e: { vendorId: string; methodId: string; providerEventId: string; signatureValid: boolean; payload: Record<string, unknown>; result: string }) {
    try { await this.prisma.v3VendorPaymentEvent.create({ data: { vendorId: e.vendorId, methodId: e.methodId, providerEventId: e.providerEventId, signatureValid: e.signatureValid, payloadJson: e.payload as Prisma.InputJsonValue, result: e.result } }); return true; }
    catch (err) { if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return false; throw err; }
  }

  // ── invoices, offers, stock ──
  async createInvoice(d: { vendorId: string; orderId: string | null; requestId: string | null; snapshot: Record<string, unknown>; prefix: string; now: Date }) {
    return this.queue.run(`orders:${d.vendorId}`, () => this.prisma.$transaction(async (tx) => {
      const seq = await this.nextNumber(tx, d.vendorId, 'INVOICE');
      return toInv(await tx.v3VendorInvoice.create({ data: { vendorId: d.vendorId, orderId: d.orderId, requestId: d.requestId, seq, invoiceNumber: formatInvoiceNumber(d.prefix, seq), issuedAt: d.now, snapshotJson: d.snapshot as Prisma.InputJsonValue } }));
    }, { maxWait: 15_000 }));
  }
  async listInvoices(vendorId: string, skip: number, take: number) {
    const [items, total] = await Promise.all([this.prisma.v3VendorInvoice.findMany({ where: { vendorId }, orderBy: { seq: 'desc' }, skip, take }), this.prisma.v3VendorInvoice.count({ where: { vendorId } })]);
    return { items: items.map(toInv), total };
  }
  async getInvoice(id: string, vendorId: string) { const i = await this.prisma.v3VendorInvoice.findFirst({ where: { id, vendorId } }); return i ? toInv(i) : null; }
  async voidInvoice(id: string, vendorId: string, reason: string, now: Date) {
    await this.prisma.v3VendorInvoice.updateMany({ where: { id, vendorId, status: 'ISSUED' }, data: { status: 'VOID', voidedAt: now, voidReason: reason } });
    return this.getInvoice(id, vendorId);
  }
  async createOffer(d: Omit<OfferRow, 'id' | 'usedCount' | 'createdAt' | 'updatedAt'>) {
    return toOffer(await this.prisma.v3Offer.create({ data: { vendorId: d.vendorId, kind: d.kind, title: d.title, code: d.code ?? null, percentOff: d.percentOff ?? null, flatPaise: d.flatPaise ?? null, minOrderPaise: d.minOrderPaise, startsAt: d.startsAt, endsAt: d.endsAt, usageLimit: d.usageLimit, status: d.status } }));
  }
  async listOffers(vendorId: string) { return (await this.prisma.v3Offer.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' } })).map(toOffer); }
  async getOffer(id: string, vendorId: string) { const o = await this.prisma.v3Offer.findFirst({ where: { id, vendorId } }); return o ? toOffer(o) : null; }
  async offerByCode(vendorId: string, code: string) { const o = await this.prisma.v3Offer.findUnique({ where: { vendorId_code: { vendorId, code } } }); return o ? toOffer(o) : null; }
  async updateOffer(id: string, vendorId: string, p: Partial<Pick<OfferRow, 'title' | 'percentOff' | 'flatPaise' | 'minOrderPaise' | 'startsAt' | 'endsAt' | 'usageLimit' | 'status'>>) {
    const res = await this.prisma.v3Offer.updateMany({ where: { id, vendorId }, data: p });
    return res.count === 1 ? this.getOffer(id, vendorId) : null;
  }
  async setStock(vendorId: string, productRef: string, onHand: number) { await this.prisma.v3StockLevel.upsert({ where: { vendorId_productRef: { vendorId, productRef } }, create: { vendorId, productRef, onHand }, update: { onHand } }); }
  async getStock(vendorId: string, productRef: string) { const s = await this.prisma.v3StockLevel.findUnique({ where: { vendorId_productRef: { vendorId, productRef } } }); return s ? { onHand: s.onHand, reserved: s.reserved } : null; }
  async releaseExpiredReservations(now: Date) {
    let n = 0;
    for (const r of await this.prisma.v3StockReservation.findMany({ where: { releasedAt: null, committedAt: null, expiresAt: { lte: now } }, take: 500 })) {
      const done = await this.prisma.$transaction(async (tx) => {
        const res = await tx.v3StockReservation.updateMany({ where: { id: r.id, releasedAt: null, committedAt: null }, data: { releasedAt: now } });
        if (res.count !== 1) return false;
        await tx.$executeRaw`UPDATE "g4d_stock_levels" SET "reserved" = "reserved" - ${r.qty}, "updatedAt" = NOW() WHERE "vendorId" = ${r.vendorId} AND "productRef" = ${r.productRef}`;
        return true;
      });
      if (done) n++;
    }
    return n;
  }

  // ── messages, reports, blocklist ──
  async addMessage(m: Omit<OutboxRow, 'id' | 'createdAt'>, at: Date) {
    return toMsg(await this.prisma.v3MessageOutbox.create({ data: { vendorId: m.vendorId, channel: m.channel === 'DASHBOARD' ? 'EMAIL' : m.channel, templateKey: m.templateKey, toHash: m.toHash, toMasked: m.toMasked, payloadRedactedJson: m.payload as Prisma.InputJsonValue, senderRoute: m.senderRoute, status: m.status, attempts: m.attempts, relatedRequestId: m.relatedRequestId, createdAt: at } }));
  }
  async listOutbox(f: { vendorId?: string; requestId?: string; skip: number; take: number }) {
    const where: Prisma.V3MessageOutboxWhereInput = { ...(f.vendorId ? { vendorId: f.vendorId } : {}), ...(f.requestId ? { relatedRequestId: f.requestId } : {}) };
    const [items, total] = await Promise.all([this.prisma.v3MessageOutbox.findMany({ where, orderBy: { createdAt: 'desc' }, skip: f.skip, take: f.take }), this.prisma.v3MessageOutbox.count({ where })]);
    return { items: items.map(toMsg), total };
  }
  async suppressed(hash: string, channel: Channel) { return (await this.prisma.v3MessageSuppression.count({ where: { hash, channel } })) > 0; }
  async addSuppression(hash: string, channel: Channel) { const before = await this.suppressed(hash, channel); await this.prisma.v3MessageSuppression.upsert({ where: { hash_channel: { hash, channel } }, create: { hash, channel }, update: {} }); return !before; }

  async createReport(r: Omit<ReportRow, 'id' | 'status' | 'handledBy' | 'handledAt' | 'createdAt'>) { return (await this.prisma.v3Report.create({ data: r })) as ReportRow; }
  async listReports(f: { status?: ReportRow['status']; skip: number; take: number }) {
    const where: Prisma.V3ReportWhereInput = f.status ? { status: f.status } : {};
    const [items, total] = await Promise.all([this.prisma.v3Report.findMany({ where, orderBy: { createdAt: 'desc' }, skip: f.skip, take: f.take }), this.prisma.v3Report.count({ where })]);
    return { items: items as ReportRow[], total };
  }
  async handleReport(id: string, status: ReportRow['status'], by: string | null, now: Date) {
    const res = await this.prisma.v3Report.updateMany({ where: { id }, data: { status, handledBy: by, handledAt: now } });
    return res.count === 1 ? ((await this.prisma.v3Report.findUnique({ where: { id } })) as ReportRow) : null;
  }
  async addBlock(b: Omit<BlockRow, 'id' | 'at'>, at: Date) { return (await this.prisma.v3Blocklist.upsert({ where: { kind_hash: { kind: b.kind, hash: b.hash } }, create: { ...b, at }, update: {} })) as BlockRow; }
  async listBlocks(skip: number, take: number) { const [items, total] = await Promise.all([this.prisma.v3Blocklist.findMany({ orderBy: { at: 'desc' }, skip, take }), this.prisma.v3Blocklist.count()]); return { items: items as BlockRow[], total }; }
  async removeBlock(id: string) { return (await this.prisma.v3Blocklist.deleteMany({ where: { id } })).count === 1; }
  async isBlocked(kind: BlockRow['kind'], hash: string) { return (await this.prisma.v3Blocklist.count({ where: { kind, hash } })) > 0; }

  async recordAudit(actor: Actor, action: string, entityType: string, entityId: string | null, before: unknown, after: unknown) { await this.prisma.$transaction((tx) => this.audits.record(tx, actor, action, entityType, entityId, before, after)); }
}
