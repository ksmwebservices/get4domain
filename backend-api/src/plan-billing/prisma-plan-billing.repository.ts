import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { advisoryXactLock } from '../common/db-lock';
import { PrismaService } from '../prisma/prisma.service';
import { Actor, AuditService } from '../plans/admin/audit.service';
import { SubscriptionsService } from '../plans/subscriptions/subscriptions.service';
import { DiscountRuleRow, TaxRateRow } from '../plans/pricing/price-quote';
import { OrderStatus } from './core/order-state';
import {
  AssignArgs, BillingTx, DueSub, DuplicateOrderError, EventRow, InvoiceRow, NewOrder, OrderPatch, OrderRow, PlanBillingRepository, PlanRow, PriceRow, SubRow, VendorRow,
} from './plan-billing.repository';

const isUnique = (e: unknown): boolean => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
type Db = Prisma.TransactionClient | PrismaService;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

const toOrder = (o: Prisma.V3PlanOrderGetPayload<Record<string, never>>): OrderRow => ({
  id: o.id, vendorId: o.vendorId, planId: o.planId, termMonths: o.termMonths, kind: o.kind, quote: obj(o.quoteJson), amountPaise: o.amountPaise, currency: o.currency, status: o.status,
  providerOrderId: o.providerOrderId, idempotencyKey: o.idempotencyKey, expiresAt: o.expiresAt, createdByType: o.createdByType, createdById: o.createdById, paymentId: o.paymentId,
  paidAmountPaise: o.paidAmountPaise, paidAt: o.paidAt, source: o.source, reason: o.reason, subscriptionId: o.subscriptionId, refundRecordedPaise: o.refundRecordedPaise, refundNote: o.refundNote,
  refundRecordedBy: o.refundRecordedBy, refundRecordedAt: o.refundRecordedAt, createdAt: o.createdAt, updatedAt: o.updatedAt,
});
const toInvoice = (i: Prisma.V3PlanInvoiceGetPayload<Record<string, never>>): InvoiceRow => ({ id: i.id, vendorId: i.vendorId, orderId: i.orderId, invoiceNumber: i.invoiceNumber, financialYear: i.financialYear, issuedAt: i.issuedAt, snapshot: obj(i.snapshotJson), taxBreakdown: obj(i.taxBreakdownJson) });
const toEvent = (e: Prisma.V3PaymentEventGetPayload<Record<string, never>>): EventRow => ({ id: e.id, provider: e.provider, providerEventId: e.providerEventId, type: e.type, payloadRedacted: obj(e.payloadRedactedJson), signatureValid: e.signatureValid, orderId: e.orderId, processedAt: e.processedAt, result: e.result, createdAt: e.createdAt });
const toPlan = (p: { id: string; key: string; track: string; level: string; name: string; status: string; isPublic: boolean }): PlanRow => ({ id: p.id, key: p.key, track: p.track, level: p.level as 'FREE' | 'PRO', name: p.name, status: p.status as PlanRow['status'], isPublic: p.isPublic });
const patchData = (p: OrderPatch): Prisma.V3PlanOrderUncheckedUpdateManyInput => ({ ...p });

async function currentSubOn(db: Db, vendorId: string): Promise<SubRow | null> {
  const s = await db.v3PlanSubscription.findUnique({ where: { currentVendorId: vendorId }, include: { plan: true } });
  if (!s) return null;
  const snap = obj(s.priceSnapshotJson);
  return { id: s.id, vendorId: s.vendorId, planId: s.planId, planKey: s.plan.key, track: s.plan.track, level: s.plan.level, status: s.status, startsAt: s.startsAt, endsAt: s.endsAt, graceEndsAt: s.graceEndsAt, termMonths: s.termMonths, amountPaise: typeof snap.amountPaise === 'number' ? snap.amountPaise : null };
}

@Injectable()
export class PrismaPlanBillingRepository extends PlanBillingRepository {
  constructor(private readonly prisma: PrismaService, private readonly audits: AuditService, private readonly subscriptions: SubscriptionsService) { super(); }

  async getPlanByKey(key: string) { const p = await this.prisma.v3Plan.findUnique({ where: { key } }); return p ? toPlan(p) : null; }
  async getPlanById(id: string) { const p = await this.prisma.v3Plan.findUnique({ where: { id } }); return p ? toPlan(p) : null; }
  async activePrice(planId: string, termMonths: number, now: Date): Promise<PriceRow | null> {
    const p = await this.prisma.v3PlanPrice.findFirst({ where: { planId, termMonths, status: 'APPROVED', effectiveFrom: { lte: now } }, orderBy: { effectiveFrom: 'desc' } });
    return p ? { id: p.id, amountPaise: p.amountPaise, currency: p.currency, taxInclusive: p.taxInclusive } : null;
  }
  async taxRates(): Promise<TaxRateRow[]> { return (await this.prisma.v3TaxRate.findMany()).map((t) => ({ name: t.name, ratePercent: Number(t.ratePercent), appliesTo: t.appliesTo, active: t.active, validFrom: t.validFrom })); }
  async discountRules(): Promise<DiscountRuleRow[]> {
    return (await this.prisma.v3DiscountRule.findMany()).map((r) => ({ type: r.type, name: r.name, percentOff: r.percentOff === null ? null : Number(r.percentOff), amountOffPaise: r.amountOffPaise, conditions: obj(r.conditions), stackable: r.stackable, active: r.active, status: r.status as 'PROPOSED' | 'APPROVED', validFrom: r.validFrom, validTo: r.validTo }));
  }
  async vendor(vendorId: string): Promise<VendorRow | null> { const v = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true, name: true, businessName: true, email: true, phone: true } }); return v ? { ...v, phone: v.phone ?? null } : null; }
  currentSub(vendorId: string) { return currentSubOn(this.prisma, vendorId); }

  async getOrder(id: string) { const o = await this.prisma.v3PlanOrder.findUnique({ where: { id } }); return o ? toOrder(o) : null; }
  async findOrderByProviderId(providerOrderId: string) { const o = await this.prisma.v3PlanOrder.findUnique({ where: { providerOrderId } }); return o ? toOrder(o) : null; }
  async findOrderByIdempotency(vendorId: string, key: string) { const o = await this.prisma.v3PlanOrder.findUnique({ where: { vendorId_idempotencyKey: { vendorId, idempotencyKey: key } } }); return o ? toOrder(o) : null; }
  async createOrder(d: NewOrder): Promise<OrderRow> {
    try { return toOrder(await this.prisma.v3PlanOrder.create({ data: { vendorId: d.vendorId, planId: d.planId, termMonths: d.termMonths, kind: d.kind, quoteJson: d.quote as Prisma.InputJsonValue, amountPaise: d.amountPaise, currency: d.currency, idempotencyKey: d.idempotencyKey, expiresAt: d.expiresAt, createdByType: d.createdByType, createdById: d.createdById } })); } catch (e) { if (isUnique(e)) throw new DuplicateOrderError(); throw e; }
  }
  async updateOrderCas(id: string, expected: OrderStatus[], patch: OrderPatch) { return (await this.prisma.v3PlanOrder.updateMany({ where: { id, status: { in: expected } }, data: patchData(patch) })).count === 1; }
  async listOrdersForVendor(vendorId: string, skip: number, take: number) {
    const [rows, total] = await Promise.all([this.prisma.v3PlanOrder.findMany({ where: { vendorId }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take }), this.prisma.v3PlanOrder.count({ where: { vendorId } })]);
    return { items: rows.map(toOrder), total };
  }
  async listOrders(q: { vendorId?: string; status?: OrderStatus; skip: number; take: number }) {
    const where: Prisma.V3PlanOrderWhereInput = { ...(q.vendorId ? { vendorId: q.vendorId } : {}), ...(q.status ? { status: q.status } : {}) };
    const [rows, total] = await Promise.all([this.prisma.v3PlanOrder.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: q.skip, take: q.take }), this.prisma.v3PlanOrder.count({ where })]);
    return { items: rows.map(toOrder), total };
  }
  async expireStale(now: Date) { return (await this.prisma.v3PlanOrder.updateMany({ where: { status: { in: ['CREATED', 'PENDING_PAYMENT'] }, expiresAt: { lt: now } }, data: { status: 'EXPIRED' } })).count; }

  async listInvoicesForVendor(vendorId: string, skip: number, take: number) {
    const [rows, total] = await Promise.all([this.prisma.v3PlanInvoice.findMany({ where: { vendorId }, orderBy: [{ issuedAt: 'desc' }, { id: 'asc' }], skip, take }), this.prisma.v3PlanInvoice.count({ where: { vendorId } })]);
    return { items: rows.map(toInvoice), total };
  }

  async insertEvent(d: { providerEventId: string; type: string; payloadRedacted: Record<string, unknown>; signatureValid: boolean; orderId: string | null }) {
    try { return { created: true, row: toEvent(await this.prisma.v3PaymentEvent.create({ data: { providerEventId: d.providerEventId, type: d.type, payloadRedactedJson: d.payloadRedacted as Prisma.InputJsonValue, signatureValid: d.signatureValid, orderId: d.orderId } })) }; }
    catch (e) { if (isUnique(e)) return { created: false, row: toEvent(await this.prisma.v3PaymentEvent.findUniqueOrThrow({ where: { providerEventId: d.providerEventId } })) }; throw e; }
  }
  async finishEvent(providerEventId: string, patch: { processedAt: Date; result: string; orderId?: string | null }) { await this.prisma.v3PaymentEvent.update({ where: { providerEventId }, data: { processedAt: patch.processedAt, result: patch.result, ...(patch.orderId !== undefined ? { orderId: patch.orderId } : {}) } }); }
  async listEvents(q: { orderId?: string; skip: number; take: number }) {
    const where: Prisma.V3PaymentEventWhereInput = q.orderId ? { orderId: q.orderId } : {};
    const [rows, total] = await Promise.all([this.prisma.v3PaymentEvent.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: q.skip, take: q.take }), this.prisma.v3PaymentEvent.count({ where })]);
    return { items: rows.map(toEvent), total };
  }

  transaction<T>(vendorId: string, fn: (tx: BillingTx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (db) => {
      await advisoryXactLock(db, `plan-billing:${vendorId}`);
      const tx: BillingTx = {
        getOrder: async (id) => { const o = await db.v3PlanOrder.findUnique({ where: { id } }); return o ? toOrder(o) : null; },
        updateOrderCas: async (id, expected, patch) => (await db.v3PlanOrder.updateMany({ where: { id, status: { in: expected } }, data: patchData(patch) })).count === 1,
        currentSub: (v) => currentSubOn(db, v),
        vendor: async (v) => { const r = await db.vendor.findUnique({ where: { id: v }, select: { id: true, name: true, businessName: true, email: true, phone: true } }); return r ? { ...r, phone: r.phone ?? null } : null; },
        getPlanById: async (id) => { const p = await db.v3Plan.findUnique({ where: { id } }); return p ? toPlan(p) : null; },
        assign: async (a: AssignArgs) => { const s = await this.subscriptions.assignInTx(db, { vendorId: a.vendorId, planKey: a.planKey, termMonths: a.termMonths, endsAt: a.endsAt, source: a.source, actor: a.actor, reason: a.reason, now: a.now }); return { id: s.id, endsAt: s.endsAt }; },
        nextInvoiceNumber: async (fy) => {
          await db.$executeRaw`INSERT INTO "g4d_invoice_counters" ("financialYear", "lastNumber", "updatedAt") VALUES (${fy}, 0, now()) ON CONFLICT ("financialYear") DO NOTHING`;
          const rows = await db.$queryRaw<Array<{ lastNumber: number }>>`UPDATE "g4d_invoice_counters" SET "lastNumber" = "lastNumber" + 1, "updatedAt" = now() WHERE "financialYear" = ${fy} RETURNING "lastNumber"`;
          return Number(rows[0].lastNumber);
        },
        insertInvoice: async (d) => toInvoice(await db.v3PlanInvoice.create({ data: { vendorId: d.vendorId, orderId: d.orderId, invoiceNumber: d.invoiceNumber, financialYear: d.financialYear, issuedAt: d.issuedAt, snapshotJson: d.snapshot as Prisma.InputJsonValue, taxBreakdownJson: d.taxBreakdown as Prisma.InputJsonValue } })),
        audit: (actor: Actor, action, entityId, before, after) => this.audits.record(db, actor, action, 'plan_order', entityId, before, after),
      };
      return fn(tx);
    }, { timeout: 30_000 });
  }

  async dueSubscriptions(now: Date, maxDays: number): Promise<DueSub[]> {
    const rows = await this.prisma.v3PlanSubscription.findMany({
      where: { currentVendorId: { not: null }, status: 'ACTIVE', plan: { level: 'PRO' }, endsAt: { gt: now, lte: new Date(now.getTime() + maxDays * 86_400_000) } },
      include: { vendor: { select: { email: true, businessName: true } } }, take: 500, orderBy: { endsAt: 'asc' },
    });
    return rows.map((r) => ({ id: r.id, vendorId: r.vendorId, endsAt: r.endsAt as Date, status: r.status, email: r.vendor.email, businessName: r.vendor.businessName }));
  }
  async loggedReminders(subscriptionIds: string[]): Promise<Set<string>> {
    const rows = subscriptionIds.length ? await this.prisma.v3ReminderLog.findMany({ where: { subscriptionId: { in: subscriptionIds } } }) : [];
    return new Set(rows.map((r) => `${r.subscriptionId}|${r.daysBefore}|${r.endsAt.toISOString()}`));
  }
  async insertReminder(d: { subscriptionId: string; daysBefore: number; endsAt: Date; kind: 'SENT' | 'SKIPPED' }): Promise<boolean> {
    try { await this.prisma.v3ReminderLog.create({ data: d }); return true; } catch (e) { if (isUnique(e)) return false; throw e; }
  }
}
