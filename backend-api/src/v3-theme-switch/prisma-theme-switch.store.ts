import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Actor, AuditService } from '../plans/admin/audit.service';
import { ServicesStore, ServicesTx } from '../v3-services/services.store';
import { WalletTx } from '../v3-wallet/wallet.store';
import { PriorSwitch, SwitchStatus } from './core/theme-switch-core';
import { DuplicateSwitchError, NewSwitch, SwitchPatch, SwitchRow, SwitchTx, ThemeSwitchStore } from './theme-switch.store';

const isUnique = (e: unknown): boolean => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const toRow = (r: Prisma.V3ThemeSwitchGetPayload<Record<string, never>>): SwitchRow => ({
  id: r.id, vendorId: r.vendorId, siteId: r.siteId, fromThemeKey: r.fromThemeKey, toThemeKey: r.toThemeKey, kind: r.kind, performedByType: r.performedByType as SwitchRow['performedByType'], performedById: r.performedById,
  serviceRequestId: r.serviceRequestId, ledgerEntryId: r.ledgerEntryId, packPurchaseId: r.packPurchaseId, priceSnapshotPaise: r.priceSnapshotPaise, taxSnapshot: obj(r.taxSnapshotJson), publicationId: r.publicationId,
  status: r.status, idempotencyKey: r.idempotencyKey, reason: r.reason, failureReason: r.failureReason, hiddenFields: (Array.isArray(r.hiddenFieldsJson) ? r.hiddenFieldsJson : []).filter((x): x is string => typeof x === 'string'), createdAt: r.createdAt, updatedAt: r.updatedAt,
});
const OPEN_REQUEST = ['ACCEPTED', 'IN_PRODUCTION', 'READY_FOR_REVIEW', 'REVISION_REQUESTED'] as const;

/** The theme switch side of a unit of work on an OPEN transaction client. Every statement carries the vendor id. */
export function prismaSwitchTx(db: Prisma.TransactionClient, vendorId: string, audits: AuditService): SwitchTx {
  return {
    insert: async (d: NewSwitch) => {
      try {
        return toRow(await db.v3ThemeSwitch.create({
          data: {
            id: d.id, vendorId: d.vendorId, siteId: d.siteId, fromThemeKey: d.fromThemeKey, toThemeKey: d.toThemeKey, kind: d.kind, performedByType: d.performedByType, performedById: d.performedById, serviceRequestId: d.serviceRequestId,
            ledgerEntryId: d.ledgerEntryId, packPurchaseId: d.packPurchaseId, priceSnapshotPaise: d.priceSnapshotPaise, taxSnapshotJson: d.taxSnapshot as Prisma.InputJsonValue, status: d.status, idempotencyKey: d.idempotencyKey, reason: d.reason,
            hiddenFieldsJson: d.hiddenFields as Prisma.InputJsonValue,
          },
        }));
      } catch (e) { if (isUnique(e)) throw new DuplicateSwitchError(); throw e; }
    },
    findByKey: async (key) => { const r = await db.v3ThemeSwitch.findUnique({ where: { vendorId_idempotencyKey: { vendorId, idempotencyKey: key } } }); return r ? toRow(r) : null; },
    get: async (id) => { const r = await db.v3ThemeSwitch.findFirst({ where: { id, vendorId } }); return r ? toRow(r) : null; },
    updateCas: async (id, expected: SwitchStatus[], patch: SwitchPatch) => (await db.v3ThemeSwitch.updateMany({ where: { id, vendorId, status: { in: expected } }, data: { ...patch } })).count === 1,
    priors: async () => (await db.v3ThemeSwitch.findMany({ where: { vendorId }, select: { kind: true, status: true } })).map((r) => ({ kind: r.kind, status: r.status })),
    requestCarriesFee: async (requestId, toThemeKey) => {
      const r = await db.v3ServiceRequest.findFirst({ where: { id: requestId, vendorId, service: { key: 'THEME_SWITCH' }, status: { in: [...OPEN_REQUEST] } }, select: { briefJson: true } });
      return !!r && obj(r.briefJson).themeKey === toThemeKey;
    },
    audit: (actor: Actor, action, entityId, before, after) => audits.record(db, actor, action, 'theme_switch', entityId, before, after),
  };
}

@Injectable()
export class PrismaThemeSwitchStore extends ThemeSwitchStore {
  constructor(private readonly prisma: PrismaService, private readonly audits: AuditService, private readonly services: ServicesStore) { super(); }
  unit<T>(vendorId: string, fn: (t: SwitchTx, s: ServicesTx, w: WalletTx) => Promise<T>): Promise<T> {
    return this.services.withWallet(vendorId, (stx, wtx) => fn(prismaSwitchTx(wtx.db as Prisma.TransactionClient, vendorId, this.audits), stx, wtx));
  }
  async findByKey(vendorId: string, key: string) { const r = await this.prisma.v3ThemeSwitch.findUnique({ where: { vendorId_idempotencyKey: { vendorId, idempotencyKey: key } } }); return r ? toRow(r) : null; }
  async priors(vendorId: string): Promise<PriorSwitch[]> { return (await this.prisma.v3ThemeSwitch.findMany({ where: { vendorId }, select: { kind: true, status: true } })).map((r) => ({ kind: r.kind, status: r.status })); }
  async listForVendor(vendorId: string, skip: number, take: number) {
    const [rows, total] = await Promise.all([this.prisma.v3ThemeSwitch.findMany({ where: { vendorId }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take }), this.prisma.v3ThemeSwitch.count({ where: { vendorId } })]);
    return { items: rows.map(toRow), total };
  }
  async stalePending(before: Date, limit: number) { return (await this.prisma.v3ThemeSwitch.findMany({ where: { status: 'PENDING', updatedAt: { lt: before } }, take: limit, orderBy: { updatedAt: 'asc' } })).map(toRow); }
}
