import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddonRecord, CapabilityRecord, CategoryRecord, MatrixRecord, PackRecord, TabRecord, Tier } from './core/pack-core';
import {
  PackReferenceStore, PackVendorStore, StoredAddon, StoredCapability, StoredCategory, StoredMatrixCell, StoredPack, StoredPause, StoredTab, StoredVendorAddon, StoredVendorCapability, StoredVendorPack,
} from './pack-engine.store';

const json = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

type TabRow = { id: string; scope: string; ownerKey: string; key: string; label: string; route: string; minTier: string | null; capabilityKey: string | null; freeTrial: boolean; sortOrder: number; active: boolean };
type CatRow = { id: string; categoryKey: string; name: string; family: string; packKey: string; minTier: string; optionalCapabilities: unknown; starterServices: unknown; fieldHints: unknown; addonPacks: unknown; onlineShopNote: string | null; statusNote: string | null; needsBlueprint: boolean; ownerNotes: string | null; active: boolean };

const toTab = (r: TabRow): StoredTab => ({ id: r.id, scope: r.scope as StoredTab['scope'], ownerKey: r.ownerKey, key: r.key, label: r.label, route: r.route, minTier: (r.minTier as Tier | null) ?? null, capabilityKey: r.capabilityKey, freeTrial: r.freeTrial, sortOrder: r.sortOrder, active: r.active });
const toCat = (r: CatRow): StoredCategory => ({
  id: r.id, categoryKey: r.categoryKey, name: r.name, family: r.family, packKey: r.packKey, minTier: r.minTier as Tier, optionalCapabilities: strings(r.optionalCapabilities), starterServices: strings(r.starterServices),
  fieldHints: strings(r.fieldHints), addonPacks: (Array.isArray(r.addonPacks) ? r.addonPacks : []) as CategoryRecord['addonPacks'], onlineShopNote: r.onlineShopNote, statusNote: r.statusNote,
  needsBlueprint: r.needsBlueprint, ownerNotes: r.ownerNotes, active: r.active,
});

/** Reference data: packs, tabs, capabilities, the tier matrix, the category map and the add-on packs. No vendor id here, so none of it is tenant data. */
@Injectable()
export class PrismaPackReferenceStore extends PackReferenceStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  async listPacks(): Promise<StoredPack[]> { return this.prisma.v3Pack.findMany({ orderBy: { key: 'asc' } }); }
  async getPack(key: string): Promise<StoredPack | null> { return this.prisma.v3Pack.findUnique({ where: { key } }); }
  async createPacks(rows: PackRecord[]): Promise<void> {
    if (rows.length) await this.prisma.v3Pack.createMany({ data: rows.map((r) => ({ key: r.key, name: r.name, disclaimerKey: r.disclaimerKey, reviewStatus: r.reviewStatus, config: json(r.config) })), skipDuplicates: true });
  }
  async updatePack(key: string, patch: { name?: string; enabled?: boolean; disclaimerKey?: string | null; reviewStatus?: string; config?: unknown }, staffId: string | null): Promise<StoredPack | null> {
    const have = await this.prisma.v3Pack.findUnique({ where: { key } });
    if (!have) return null;
    return this.prisma.v3Pack.update({ where: { key }, data: { name: patch.name, enabled: patch.enabled, disclaimerKey: patch.disclaimerKey, reviewStatus: patch.reviewStatus, config: patch.config === undefined ? undefined : json(patch.config), updatedByStaffId: staffId } });
  }

  async listTabs(): Promise<StoredTab[]> { return (await this.prisma.v3PackTab.findMany({ orderBy: [{ scope: 'asc' }, { ownerKey: 'asc' }, { sortOrder: 'asc' }] })).map(toTab); }
  async createTabs(rows: TabRecord[]): Promise<void> { if (rows.length) await this.prisma.v3PackTab.createMany({ data: rows, skipDuplicates: true }); }
  async getTab(scope: string, ownerKey: string, key: string): Promise<StoredTab | null> {
    const r = await this.prisma.v3PackTab.findUnique({ where: { scope_ownerKey_key: { scope, ownerKey, key } } });
    return r ? toTab(r) : null;
  }
  async upsertTab(row: TabRecord & { active: boolean }, staffId: string | null): Promise<StoredTab> {
    const data = { label: row.label, route: row.route, minTier: row.minTier, capabilityKey: row.capabilityKey, freeTrial: row.freeTrial, sortOrder: row.sortOrder, active: row.active, updatedByStaffId: staffId };
    return toTab(await this.prisma.v3PackTab.upsert({ where: { scope_ownerKey_key: { scope: row.scope, ownerKey: row.ownerKey, key: row.key } }, update: data, create: { scope: row.scope, ownerKey: row.ownerKey, key: row.key, ...data } }));
  }

  async listCapabilities(): Promise<StoredCapability[]> {
    return (await this.prisma.v3Capability.findMany({ orderBy: { sortOrder: 'asc' } })).map((r) => ({ id: r.id, key: r.key, name: r.name, description: r.description, sortOrder: r.sortOrder, active: r.active }));
  }
  async createCapabilities(rows: CapabilityRecord[]): Promise<void> { if (rows.length) await this.prisma.v3Capability.createMany({ data: rows, skipDuplicates: true }); }

  async listMatrix(): Promise<StoredMatrixCell[]> {
    return (await this.prisma.v3TierCapability.findMany()).map((r) => ({ tier: r.tier as Tier, capabilityKey: r.capabilityKey, allowed: r.allowed, basis: r.basis }));
  }
  async createMatrix(rows: MatrixRecord[]): Promise<void> { if (rows.length) await this.prisma.v3TierCapability.createMany({ data: rows, skipDuplicates: true }); }
  async setMatrixCell(tier: Tier, capabilityKey: string, allowed: boolean, staffId: string | null): Promise<StoredMatrixCell | null> {
    const cap = await this.prisma.v3Capability.findUnique({ where: { key: capabilityKey } });
    if (!cap) return null;
    const r = await this.prisma.v3TierCapability.upsert({ where: { tier_capabilityKey: { tier, capabilityKey } }, update: { allowed, basis: 'STAFF', updatedByStaffId: staffId }, create: { tier, capabilityKey, allowed, basis: 'STAFF', updatedByStaffId: staffId } });
    return { tier: r.tier as Tier, capabilityKey: r.capabilityKey, allowed: r.allowed, basis: r.basis };
  }

  async listCategories(): Promise<StoredCategory[]> { return (await this.prisma.v3PackCategory.findMany({ orderBy: { categoryKey: 'asc' } })).map(toCat); }
  async getCategory(categoryKey: string): Promise<StoredCategory | null> { const r = await this.prisma.v3PackCategory.findUnique({ where: { categoryKey } }); return r ? toCat(r) : null; }
  async createCategories(rows: CategoryRecord[]): Promise<void> {
    if (rows.length) await this.prisma.v3PackCategory.createMany({ data: rows.map((r) => ({ ...r, optionalCapabilities: json(r.optionalCapabilities), starterServices: json(r.starterServices), fieldHints: json(r.fieldHints), addonPacks: json(r.addonPacks) })), skipDuplicates: true });
  }
  async updateCategory(categoryKey: string, patch: { packKey?: string; minTier?: Tier; optionalCapabilities?: string[]; starterServices?: string[]; active?: boolean; ownerNotes?: string | null }, staffId: string | null): Promise<StoredCategory | null> {
    const have = await this.prisma.v3PackCategory.findUnique({ where: { categoryKey } });
    if (!have) return null;
    const r = await this.prisma.v3PackCategory.update({
      where: { categoryKey },
      data: {
        packKey: patch.packKey, minTier: patch.minTier, active: patch.active, ownerNotes: patch.ownerNotes, updatedByStaffId: staffId,
        optionalCapabilities: patch.optionalCapabilities === undefined ? undefined : json(patch.optionalCapabilities),
        starterServices: patch.starterServices === undefined ? undefined : json(patch.starterServices),
        needsBlueprint: patch.starterServices === undefined ? undefined : patch.starterServices.length === 0,
      },
    });
    return toCat(r);
  }

  async listAddons(): Promise<StoredAddon[]> {
    return (await this.prisma.v3PackAddon.findMany({ orderBy: { key: 'asc' } })).map((r) => ({ id: r.id, key: r.key, name: r.name, description: r.description, grantsCapabilities: strings(r.grantsCapabilities), config: (r.config ?? {}) as Record<string, unknown>, priceStatus: 'PENDING' as const, bundleDiscountStatus: 'PENDING' as const, enabled: r.enabled }));
  }
  async createAddons(rows: AddonRecord[]): Promise<void> {
    if (rows.length) await this.prisma.v3PackAddon.createMany({ data: rows.map((r) => ({ key: r.key, name: r.name, description: r.description, grantsCapabilities: json(r.grantsCapabilities), config: json(r.config), priceStatus: r.priceStatus, bundleDiscountStatus: r.bundleDiscountStatus })), skipDuplicates: true });
  }

  async getSettingBool(key: string): Promise<boolean> { return (await this.prisma.v3PlanSetting.findUnique({ where: { key } }))?.valueJson === true; }
  async setSettingBool(key: string, value: boolean): Promise<void> {
    await this.prisma.v3PlanSetting.upsert({ where: { key }, update: { valueJson: value }, create: { key, valueJson: value, description: 'Pack engine switch, default OFF' } });
  }
}

/** Tenant data: a vendor's pack, capabilities and add-on packs. Every query names the vendor. */
@Injectable()
export class PrismaPackVendorStore extends PackVendorStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  async getVendorPack(vendorId: string): Promise<StoredVendorPack | null> {
    const r = await this.prisma.v3VendorPack.findFirst({ where: { vendorId } });
    return r ? { vendorId: r.vendorId, packKey: r.packKey, categoryKey: r.categoryKey, starterPicks: strings(r.starterPicks) } : null;
  }
  async setVendorPack(vendorId: string, row: { packKey: string; categoryKey: string; starterPicks: string[]; setByType: string; setById: string | null }): Promise<StoredVendorPack> {
    const data = { packKey: row.packKey, categoryKey: row.categoryKey, starterPicks: json(row.starterPicks), setByType: row.setByType, setById: row.setById };
    const r = await this.prisma.v3VendorPack.upsert({ where: { vendorId }, update: data, create: { vendorId, ...data } });
    return { vendorId: r.vendorId, packKey: r.packKey, categoryKey: r.categoryKey, starterPicks: strings(r.starterPicks) };
  }
  async listVendorAddons(vendorId: string): Promise<StoredVendorAddon[]> {
    return (await this.prisma.v3VendorPackAddon.findMany({ where: { vendorId } })).map((r) => ({ vendorId: r.vendorId, addonKey: r.addonKey, status: r.status }));
  }
  async setVendorAddon(vendorId: string, addonKey: string, status: 'ACTIVE' | 'ENDED', setBy: { type: string; id: string | null }): Promise<StoredVendorAddon> {
    const r = await this.prisma.v3VendorPackAddon.upsert({ where: { vendorId_addonKey: { vendorId, addonKey } }, update: { status, setByType: setBy.type, setById: setBy.id }, create: { vendorId, addonKey, status, setByType: setBy.type, setById: setBy.id } });
    return { vendorId: r.vendorId, addonKey: r.addonKey, status: r.status };
  }
  async listVendorCapabilities(vendorId: string): Promise<StoredVendorCapability[]> {
    return (await this.prisma.v3VendorCapability.findMany({ where: { vendorId } })).map((r) => ({ vendorId: r.vendorId, capabilityKey: r.capabilityKey, enabled: r.enabled, source: r.source }));
  }
  async setVendorCapability(vendorId: string, capabilityKey: string, enabled: boolean, source: string): Promise<StoredVendorCapability> {
    const r = await this.prisma.v3VendorCapability.upsert({ where: { vendorId_capabilityKey: { vendorId, capabilityKey } }, update: { enabled, source }, create: { vendorId, capabilityKey, enabled, source } });
    return { vendorId: r.vendorId, capabilityKey: r.capabilityKey, enabled: r.enabled, source: r.source };
  }

  async getOpenPause(vendorId: string): Promise<StoredPause | null> {
    const r = await this.prisma.v3PlanPause.findFirst({ where: { vendorId, openVendorId: vendorId } });
    return r ? { vendorId: r.vendorId, reason: r.reason, pausedAt: r.pausedAt } : null;
  }
  async openPause(vendorId: string, reason: string, by: { type: string; id: string | null }): Promise<StoredPause | null> {
    try {
      const r = await this.prisma.v3PlanPause.create({ data: { vendorId, openVendorId: vendorId, reason, pausedByType: by.type, pausedById: by.id } });
      return { vendorId: r.vendorId, reason: r.reason, pausedAt: r.pausedAt };
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') return null;   // one open pause per vendor: someone else won
      throw e;
    }
  }
  async closePause(vendorId: string, by: { type: string; id: string | null }): Promise<boolean> {
    const r = await this.prisma.v3PlanPause.updateMany({ where: { vendorId, openVendorId: vendorId }, data: { openVendorId: null, resumedAt: new Date(), resumedByType: by.type, resumedById: by.id } });
    return r.count === 1;
  }
}
