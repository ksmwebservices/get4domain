import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { advisoryXactLock } from '../common/db-lock';
import { PrismaService } from '../prisma/prisma.service';
import { Actor, AuditService } from '../plans/admin/audit.service';
import { LotUse } from './core/wallet-core';
import {
  AdminWalletRow, Commit, DuplicateTopupError, LedgerRow, LotRow, NewTopup, PaidProEvidence, ReceiptRow, TopupPatch, TopupRow, TopupStatus, WalletRow, WalletStatus, WalletStore, WalletTx, WalletTxProvider,
  WalletVersionError, walletKey, walletQueue,
} from './wallet.store';

const isUnique = (e: unknown): boolean => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

const toWallet = (w: Prisma.V3WalletGetPayload<Record<string, never>>): WalletRow => ({
  id: w.id, vendorId: w.vendorId, status: w.status, balancePaise: w.balancePaise, heldPaise: w.heldPaise, entryCount: w.entryCount, version: w.version, activatedAt: w.activatedAt, activatedByEventId: w.activatedByEventId,
  frozenReason: w.frozenReason, billingStateCode: w.billingStateCode, billingGstin: w.billingGstin, createdAt: w.createdAt, updatedAt: w.updatedAt,
});
const toLot = (l: Prisma.V3WalletLotGetPayload<Record<string, never>>): LotRow => ({ id: l.id, walletId: l.walletId, vendorId: l.vendorId, topupId: l.topupId, source: l.source, amountPaise: l.amountPaise, remainingPaise: l.remainingPaise, expiresAt: l.expiresAt, status: l.status, createdAt: l.createdAt });
const toLedger = (e: Prisma.V3WalletLedgerGetPayload<Record<string, never>>): LedgerRow => ({
  id: e.id, walletId: e.walletId, vendorId: e.vendorId, entryNo: e.entryNo, kind: e.kind, amountPaise: e.amountPaise, balanceDeltaPaise: e.balanceDeltaPaise, heldDeltaPaise: e.heldDeltaPaise, balanceAfterPaise: e.balanceAfterPaise,
  heldAfterPaise: e.heldAfterPaise, refType: e.refType, refId: e.refId, idempotencyKey: e.idempotencyKey, holdId: e.holdId, reversesId: e.reversesId, reason: e.reason, actorType: e.actorType, actorId: e.actorId,
  lotUses: (Array.isArray(e.lotUsesJson) ? e.lotUsesJson : []) as unknown as LotUse[], at: e.at,
});
const toTopup = (t: Prisma.V3WalletTopupGetPayload<Record<string, never>>): TopupRow => ({
  id: t.id, vendorId: t.vendorId, amountPaise: t.amountPaise, currency: t.currency, status: t.status, providerOrderId: t.providerOrderId, idempotencyKey: t.idempotencyKey, paymentId: t.paymentId, paidAmountPaise: t.paidAmountPaise,
  paidAt: t.paidAt, ledgerId: t.ledgerId, receiptId: t.receiptId, createdByType: t.createdByType, createdById: t.createdById, expiresAt: t.expiresAt, createdAt: t.createdAt, updatedAt: t.updatedAt,
});
const toReceipt = (r: Prisma.V3WalletReceiptGetPayload<Record<string, never>>): ReceiptRow => ({ id: r.id, vendorId: r.vendorId, topupId: r.topupId, receiptNumber: r.receiptNumber, financialYear: r.financialYear, documentType: 'RECEIPT', issuedAt: r.issuedAt, snapshot: obj(r.snapshotJson) });

/** The wallet's side of a unit of work on an OPEN transaction client. Every statement carries the vendor id; the lock for this vendor is already held by whoever opened the transaction. */
export function prismaWalletTx(db: Prisma.TransactionClient, vendorId: string, audits: AuditService): WalletTx {
  const mine = async (): Promise<Prisma.V3WalletGetPayload<Record<string, never>> | null> => db.v3Wallet.findUnique({ where: { vendorId } });
  return {
    vendorId,
    wallet: async () => { const w = await mine(); return w ? toWallet(w) : null; },
    ensureWallet: async () => toWallet(await db.v3Wallet.upsert({ where: { vendorId }, create: { vendorId }, update: {} })),
    lots: async () => (await db.v3WalletLot.findMany({ where: { vendorId }, orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] })).map(toLot),
    ledgerByKey: async (key) => { const w = await mine(); if (!w) return null; const e = await db.v3WalletLedger.findUnique({ where: { walletId_idempotencyKey: { walletId: w.id, idempotencyKey: key } } }); return e ? toLedger(e) : null; },
    ledgerById: async (id) => { const e = await db.v3WalletLedger.findFirst({ where: { id, vendorId } }); return e ? toLedger(e) : null; },
    consumerOfHold: async (holdId) => { const e = await db.v3WalletLedger.findFirst({ where: { holdId, vendorId } }); return e ? toLedger(e) : null; },
    reversalOf: async (chargeId) => { const e = await db.v3WalletLedger.findFirst({ where: { reversesId: chargeId, vendorId } }); return e ? toLedger(e) : null; },
    commit: async (c: Commit) => {
      const upd = await db.v3Wallet.updateMany({ where: { vendorId, version: c.expectedVersion }, data: { balancePaise: c.balancePaise, heldPaise: c.heldPaise, version: { increment: 1 }, entryCount: { increment: 1 } } });
      if (upd.count !== 1) throw new WalletVersionError();
      const w = (await mine())!;
      for (const u of c.lotUpdates) await db.v3WalletLot.updateMany({ where: { id: u.id, vendorId }, data: { remainingPaise: u.remainingPaise, status: u.status } });
      if (c.newLot) await db.v3WalletLot.create({ data: { id: c.newLot.id, walletId: w.id, vendorId, topupId: c.newLot.topupId, source: c.newLot.source, amountPaise: c.newLot.amountPaise, remainingPaise: c.newLot.remainingPaise, expiresAt: c.newLot.expiresAt, createdAt: c.newLot.createdAt } });
      const e = c.entry;
      return toLedger(await db.v3WalletLedger.create({
        data: {
          walletId: w.id, vendorId, entryNo: w.entryCount, kind: e.kind, amountPaise: e.amountPaise, balanceDeltaPaise: e.balanceDeltaPaise, heldDeltaPaise: e.heldDeltaPaise, balanceAfterPaise: e.balanceAfterPaise, heldAfterPaise: e.heldAfterPaise,
          refType: e.refType, refId: e.refId, idempotencyKey: e.idempotencyKey, holdId: e.holdId, reversesId: e.reversesId, reason: e.reason, actorType: e.actorType, actorId: e.actorId, lotUsesJson: e.lotUses as unknown as Prisma.InputJsonValue, at: c.at,
        },
      }));
    },
    activate: async (eventId, now) => (await db.v3Wallet.updateMany({ where: { vendorId, status: 'INACTIVE' }, data: { status: 'ACTIVE', activatedAt: now, activatedByEventId: eventId, version: { increment: 1 } } })).count === 1,
    setFrozen: async (frozen, reason) => toWallet(await db.v3Wallet.update({ where: { vendorId }, data: { status: frozen ? 'FROZEN' : 'ACTIVE', frozenReason: frozen ? reason : null, version: { increment: 1 } } })),
    setBillingProfile: async (p) => { await db.v3Wallet.update({ where: { vendorId }, data: { billingStateCode: p.stateCode, billingGstin: p.gstin } }); },
    insertTopup: async (d: NewTopup) => {
      try { return toTopup(await db.v3WalletTopup.create({ data: { vendorId: d.vendorId, amountPaise: d.amountPaise, currency: d.currency, idempotencyKey: d.idempotencyKey, expiresAt: d.expiresAt, createdByType: d.createdByType, createdById: d.createdById } })); } catch (e) { if (isUnique(e)) throw new DuplicateTopupError(); throw e; }
    },
    getTopup: async (id) => { const t = await db.v3WalletTopup.findFirst({ where: { id, vendorId } }); return t ? toTopup(t) : null; },
    updateTopupCas: async (id: string, expected: TopupStatus[], patch: TopupPatch) => (await db.v3WalletTopup.updateMany({ where: { id, vendorId, status: { in: expected } }, data: { ...patch } })).count === 1,
    nextNumber: async (series, fy) => {
      const key = series === 'INVOICE' ? fy : `${series}:${fy}`;   // tax invoices share the plan invoice series; every other series has its own counter row
      await db.$executeRaw`INSERT INTO "g4d_invoice_counters" ("financialYear", "lastNumber", "updatedAt") VALUES (${key}, 0, now()) ON CONFLICT ("financialYear") DO NOTHING`;
      const rows = await db.$queryRaw<Array<{ lastNumber: number }>>`UPDATE "g4d_invoice_counters" SET "lastNumber" = "lastNumber" + 1, "updatedAt" = now() WHERE "financialYear" = ${key} RETURNING "lastNumber"`;
      return Number(rows[0].lastNumber);
    },
    insertReceipt: async (d) => toReceipt(await db.v3WalletReceipt.create({ data: { vendorId: d.vendorId, topupId: d.topupId, receiptNumber: d.receiptNumber, financialYear: d.financialYear, documentType: d.documentType, issuedAt: d.issuedAt, snapshotJson: d.snapshot as Prisma.InputJsonValue } })),
    audit: (actor: Actor, action, entityId, before, after) => audits.record(db, actor, action, 'wallet', entityId, before, after),
  };
}

@Injectable()
export class PrismaWalletStore extends WalletStore {
  constructor(private readonly prisma: PrismaService, private readonly audits: AuditService) { super(); }

  /** Waiting for a vendor's turn happens in memory FIRST (walletQueue), never inside a transaction (see keyed-queue.ts: pool starvation). The advisory lock stays as the cross-process guard. */
  unit<T>(vendorId: string, fn: (tx: WalletTx) => Promise<T>): Promise<T> {
    return walletQueue.run(walletKey(vendorId), () => this.prisma.$transaction(async (db) => {
      await advisoryXactLock(db, walletKey(vendorId));
      return fn(prismaWalletTx(db, vendorId, this.audits));
    }, { timeout: 30_000, maxWait: 15_000 }));
  }

  async wallet(vendorId: string) { const w = await this.prisma.v3Wallet.findUnique({ where: { vendorId } }); return w ? toWallet(w) : null; }
  async lots(vendorId: string) { return (await this.prisma.v3WalletLot.findMany({ where: { vendorId }, orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] })).map(toLot); }
  async ledgerPage(vendorId: string, skip: number, take: number) {
    const [rows, total] = await Promise.all([this.prisma.v3WalletLedger.findMany({ where: { vendorId }, orderBy: { entryNo: 'desc' }, skip, take }), this.prisma.v3WalletLedger.count({ where: { vendorId } })]);
    return { items: rows.map(toLedger), total };
  }
  async allLedger(vendorId: string) { return (await this.prisma.v3WalletLedger.findMany({ where: { vendorId }, orderBy: { entryNo: 'asc' } })).map(toLedger); }
  async topupsPage(vendorId: string, skip: number, take: number) {
    const [rows, total] = await Promise.all([this.prisma.v3WalletTopup.findMany({ where: { vendorId }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take }), this.prisma.v3WalletTopup.count({ where: { vendorId } })]);
    return { items: rows.map(toTopup), total };
  }
  async getTopupForVendor(vendorId: string, id: string) { const t = await this.prisma.v3WalletTopup.findFirst({ where: { id, vendorId } }); return t ? toTopup(t) : null; }
  async findTopupByIdempotency(vendorId: string, key: string) { const t = await this.prisma.v3WalletTopup.findUnique({ where: { vendorId_idempotencyKey: { vendorId, idempotencyKey: key } } }); return t ? toTopup(t) : null; }
  async findTopupByProviderOrder(providerOrderId: string) { const t = await this.prisma.v3WalletTopup.findUnique({ where: { providerOrderId } }); return t ? toTopup(t) : null; }
  async receiptForTopup(vendorId: string, topupId: string) { const r = await this.prisma.v3WalletReceipt.findFirst({ where: { vendorId, topupId } }); return r ? toReceipt(r) : null; }
  async adminWallets(q: { status?: WalletStatus; skip: number; take: number }): Promise<{ items: AdminWalletRow[]; total: number }> {
    const where: Prisma.V3WalletWhereInput = q.status ? { status: q.status } : {};
    const [rows, total] = await Promise.all([this.prisma.v3Wallet.findMany({ where, include: { vendor: { select: { businessName: true } } }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], skip: q.skip, take: q.take }), this.prisma.v3Wallet.count({ where })]);
    return { items: rows.map((r) => ({ ...toWallet(r), businessName: r.vendor.businessName })), total };
  }
  async vendorsWithExpiredLots(now: Date, limit: number) {
    return (await this.prisma.v3WalletLot.findMany({ where: { remainingPaise: { gt: 0 }, expiresAt: { lte: now } }, distinct: ['vendorId'], select: { vendorId: true }, take: limit })).map((r) => r.vendorId);
  }
  async paidProEvidence(vendorId: string): Promise<PaidProEvidence | null> {
    const order = await this.prisma.v3PlanOrder.findFirst({ where: { vendorId, status: 'PAID', plan: { level: 'PRO' } }, select: { id: true }, orderBy: { paidAt: 'asc' } });
    if (order) return { kind: 'PLAN_ORDER', id: order.id };
    const sub = await this.prisma.v3PlanSubscription.findFirst({ where: { vendorId, source: 'SELF', plan: { level: 'PRO' } }, select: { id: true }, orderBy: { startsAt: 'asc' } });
    return sub ? { kind: 'SUBSCRIPTION', id: sub.id } : null;
  }
  async expireStaleTopups(now: Date) { return (await this.prisma.v3WalletTopup.updateMany({ where: { status: { in: ['CREATED', 'PENDING'] }, expiresAt: { lt: now } }, data: { status: 'EXPIRED' } })).count; }
}

@Injectable()
export class PrismaWalletTxProvider extends WalletTxProvider {
  constructor(private readonly audits: AuditService) { super(); }
  async forDb(db: unknown, vendorId: string): Promise<WalletTx> {
    const tx = db as Prisma.TransactionClient;
    await advisoryXactLock(tx, walletKey(vendorId));   // the caller already waited in walletQueue; this is the cross-process guard
    return prismaWalletTx(tx, vendorId, this.audits);
  }
}
