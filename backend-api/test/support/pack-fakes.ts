import { buildSeed, BuiltSeed } from '../../src/v3-packs/seed/pack-seed';
import { readSeedSources } from '../../src/v3-packs/seed/seed-files';
import { AddonRecord, CapabilityRecord, CategoryRecord, MatrixRecord, PackRecord, TabRecord, Tier } from '../../src/v3-packs/core/pack-core';
import { EntitlementsService } from '../../src/plans/entitlements/entitlements.service';
import {
  PackReferenceStore, PackVendorStore, StoredAddon, StoredCapability, StoredCategory, StoredMatrixCell, StoredPack, StoredTab, StoredVendorAddon, StoredVendorCapability, StoredVendorPack,
} from '../../src/v3-packs/pack-engine.store';
import { PackEngineService } from '../../src/v3-packs/pack-engine.service';

export const realSeed = (): BuiltSeed => buildSeed(readSeedSources());

/** An in-memory reference store: the same contract as the Prisma one, so the loaders and the service run for real without a database. */
export class MemoryRefStore extends PackReferenceStore {
  packs = new Map<string, StoredPack>(); tabs = new Map<string, StoredTab>(); caps = new Map<string, StoredCapability>(); matrix = new Map<string, StoredMatrixCell>();
  cats = new Map<string, StoredCategory>(); addons = new Map<string, StoredAddon>(); settings = new Map<string, boolean>();
  creates = 0;
  private n = 0;
  private id = (): string => `id${(this.n += 1)}`;
  async listPacks(): Promise<StoredPack[]> { return [...this.packs.values()]; }
  async getPack(key: string): Promise<StoredPack | null> { return this.packs.get(key) ?? null; }
  async createPacks(rows: PackRecord[]): Promise<void> { for (const r of rows) { this.creates += 1; this.packs.set(r.key, { key: r.key, name: r.name, enabled: true, disclaimerKey: r.disclaimerKey, reviewStatus: r.reviewStatus, config: r.config, updatedAt: new Date(0) }); } }
  async updatePack(key: string, patch: { name?: string; enabled?: boolean; disclaimerKey?: string | null; reviewStatus?: string; config?: unknown }): Promise<StoredPack | null> {
    const p = this.packs.get(key); if (!p) return null;
    const next = { ...p, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) } as StoredPack; this.packs.set(key, next); return next;
  }
  private tk = (s: string, o: string, k: string): string => `${s}|${o}|${k}`;
  async listTabs(): Promise<StoredTab[]> { return [...this.tabs.values()]; }
  async createTabs(rows: TabRecord[]): Promise<void> { for (const r of rows) { this.creates += 1; this.tabs.set(this.tk(r.scope, r.ownerKey, r.key), { ...r, id: this.id(), active: true }); } }
  async getTab(s: string, o: string, k: string): Promise<StoredTab | null> { return this.tabs.get(this.tk(s, o, k)) ?? null; }
  async upsertTab(row: TabRecord & { active: boolean }): Promise<StoredTab> { const t = { ...row, id: this.id() }; this.tabs.set(this.tk(row.scope, row.ownerKey, row.key), t); return t; }
  async listCapabilities(): Promise<StoredCapability[]> { return [...this.caps.values()]; }
  async createCapabilities(rows: CapabilityRecord[]): Promise<void> { for (const r of rows) { this.creates += 1; this.caps.set(r.key, { ...r, id: this.id(), active: true }); } }
  async listMatrix(): Promise<StoredMatrixCell[]> { return [...this.matrix.values()]; }
  async createMatrix(rows: MatrixRecord[]): Promise<void> { for (const r of rows) { this.creates += 1; this.matrix.set(`${r.tier}|${r.capabilityKey}`, { tier: r.tier, capabilityKey: r.capabilityKey, allowed: r.allowed, basis: r.basis }); } }
  async setMatrixCell(tier: Tier, capabilityKey: string, allowed: boolean, _staffId?: string | null): Promise<StoredMatrixCell | null> {
    if (!this.caps.has(capabilityKey)) return null;
    const c = { tier, capabilityKey, allowed, basis: 'STAFF' }; this.matrix.set(`${tier}|${capabilityKey}`, c); return c;
  }
  async listCategories(): Promise<StoredCategory[]> { return [...this.cats.values()]; }
  async getCategory(key: string): Promise<StoredCategory | null> { return this.cats.get(key) ?? null; }
  async createCategories(rows: CategoryRecord[]): Promise<void> { for (const r of rows) { this.creates += 1; this.cats.set(r.categoryKey, { ...r, id: this.id(), active: true }); } }
  async updateCategory(key: string, patch: Record<string, unknown>, _staffId?: string | null): Promise<StoredCategory | null> {
    const c = this.cats.get(key); if (!c) return null;
    const next = { ...c, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) } as StoredCategory; this.cats.set(key, next); return next;
  }
  async listAddons(): Promise<StoredAddon[]> { return [...this.addons.values()]; }
  async createAddons(rows: AddonRecord[]): Promise<void> { for (const r of rows) { this.creates += 1; this.addons.set(r.key, { ...r, id: this.id(), enabled: true }); } }
  async getSettingBool(key: string): Promise<boolean> { return this.settings.get(key) === true; }
  async setSettingBool(key: string, value: boolean): Promise<void> { this.settings.set(key, value); }
}

export async function loadedRefStore(): Promise<MemoryRefStore> {
  const { loadPackEngine } = await import('../../src/v3-packs/seed/pack-seed');
  const s = new MemoryRefStore();
  const r = await loadPackEngine(s, realSeed(), { apply: true });
  if (!r.applied) throw new Error('seed did not apply: ' + r.problems.join('; '));
  return s;
}

/** Tenant store in memory. Every method takes the vendor and keeps one vendor's rows apart from another's, as the Prisma store does. */
export class MemoryVendorStore extends PackVendorStore {
  packs = new Map<string, StoredVendorPack>(); caps = new Map<string, StoredVendorCapability>(); addons = new Map<string, StoredVendorAddon>();
  async getVendorPack(vendorId: string): Promise<StoredVendorPack | null> { return this.packs.get(vendorId) ?? null; }
  async setVendorPack(vendorId: string, row: { packKey: string; categoryKey: string; starterPicks: string[] }): Promise<StoredVendorPack> { const r = { vendorId, packKey: row.packKey, categoryKey: row.categoryKey, starterPicks: row.starterPicks }; this.packs.set(vendorId, r); return r; }
  async listVendorAddons(vendorId: string): Promise<StoredVendorAddon[]> { return [...this.addons.values()].filter((a) => a.vendorId === vendorId); }
  async setVendorAddon(vendorId: string, addonKey: string, status: 'ACTIVE' | 'ENDED'): Promise<StoredVendorAddon> { const r = { vendorId, addonKey, status }; this.addons.set(`${vendorId}|${addonKey}`, r); return r; }
  async listVendorCapabilities(vendorId: string): Promise<StoredVendorCapability[]> { return [...this.caps.values()].filter((c) => c.vendorId === vendorId); }
  async setVendorCapability(vendorId: string, capabilityKey: string, enabled: boolean, source: string): Promise<StoredVendorCapability> { const r = { vendorId, capabilityKey, enabled, source }; this.caps.set(`${vendorId}|${capabilityKey}`, r); return r; }
}

export interface PlanState { mode: 'LEGACY' | 'V3' | 'UNASSIGNED'; level: 'FREE' | 'PRO' | null; track: Tier | null }
/** A stand-in for the Stage 5.1 entitlement service: tests set what the plan engine would have resolved for each vendor. */
export class FakeEntitlements {
  states = new Map<string, PlanState>();
  async resolve(vendorId: string): Promise<{ mode: string; level: string | null; track: string | null; plan: string | null }> {
    const s = this.states.get(vendorId) ?? { mode: 'UNASSIGNED' as const, level: null, track: null };
    return { mode: s.mode, level: s.level, track: s.track, plan: s.track ? `${s.track.toLowerCase()}_${(s.level ?? 'free').toLowerCase()}` : null };
  }
}

export async function makeEngine(): Promise<{ svc: PackEngineService; refs: MemoryRefStore; vendors: MemoryVendorStore; plans: FakeEntitlements; activity: Array<{ actionKey: string; vendorId: string | null }> }> {
  const refs = await loadedRefStore(); const vendors = new MemoryVendorStore(); const plans = new FakeEntitlements(); const activity: Array<{ actionKey: string; vendorId: string | null }> = [];
  const log = { record: async (i: { actionKey: string; vendorId: string | null }) => { activity.push({ actionKey: i.actionKey, vendorId: i.vendorId }); return null; } };
  const svc = new PackEngineService(refs, vendors, plans as unknown as EntitlementsService, log as never);
  return { svc, refs, vendors, plans, activity };
}
