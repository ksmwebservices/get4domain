import { AddonRecord, CapabilityRecord, CategoryRecord, MatrixRecord, PackRecord, TabRecord, Tier } from './core/pack-core';

export interface StoredPack { key: string; name: string; enabled: boolean; disclaimerKey: string | null; reviewStatus: string; config: unknown; updatedAt: Date }
export interface StoredTab extends TabRecord { id: string; active: boolean }
export interface StoredCapability extends CapabilityRecord { id: string; active: boolean }
export interface StoredMatrixCell { tier: Tier; capabilityKey: string; allowed: boolean; basis: string }
export interface StoredCategory extends CategoryRecord { id: string; active: boolean }
export interface StoredAddon extends AddonRecord { id: string; enabled: boolean }
export interface StoredVendorAddon { vendorId: string; addonKey: string; status: string }
export interface StoredVendorPack { vendorId: string; packKey: string; categoryKey: string; starterPicks: string[] }
export interface StoredVendorCapability { vendorId: string; capabilityKey: string; enabled: boolean; source: string }

/** Reference data (packs, tabs, capabilities, matrix, category map): read and written by loaders and staff. No vendor id. */
export abstract class PackReferenceStore {
  abstract listPacks(): Promise<StoredPack[]>;
  abstract getPack(key: string): Promise<StoredPack | null>;
  abstract createPacks(rows: PackRecord[]): Promise<void>;
  abstract updatePack(key: string, patch: { name?: string; enabled?: boolean; disclaimerKey?: string | null; reviewStatus?: string; config?: unknown }, staffId: string | null): Promise<StoredPack | null>;

  abstract listTabs(): Promise<StoredTab[]>;
  abstract createTabs(rows: TabRecord[]): Promise<void>;
  abstract getTab(scope: string, ownerKey: string, key: string): Promise<StoredTab | null>;
  abstract upsertTab(row: TabRecord & { active: boolean }, staffId: string | null): Promise<StoredTab>;

  abstract listCapabilities(): Promise<StoredCapability[]>;
  abstract createCapabilities(rows: CapabilityRecord[]): Promise<void>;

  abstract listMatrix(): Promise<StoredMatrixCell[]>;
  abstract createMatrix(rows: MatrixRecord[]): Promise<void>;
  abstract setMatrixCell(tier: Tier, capabilityKey: string, allowed: boolean, staffId: string | null): Promise<StoredMatrixCell | null>;

  abstract listCategories(): Promise<StoredCategory[]>;
  abstract getCategory(categoryKey: string): Promise<StoredCategory | null>;
  abstract createCategories(rows: CategoryRecord[]): Promise<void>;
  abstract updateCategory(categoryKey: string, patch: { packKey?: string; minTier?: Tier; optionalCapabilities?: string[]; starterServices?: string[]; active?: boolean; ownerNotes?: string | null }, staffId: string | null): Promise<StoredCategory | null>;

  abstract listAddons(): Promise<StoredAddon[]>;
  abstract createAddons(rows: AddonRecord[]): Promise<void>;

  abstract getSettingBool(key: string): Promise<boolean>;
  abstract setSettingBool(key: string, value: boolean): Promise<void>;
}

/** Tenant data: every method names the vendor. */
export abstract class PackVendorStore {
  abstract getVendorPack(vendorId: string): Promise<StoredVendorPack | null>;
  abstract setVendorPack(vendorId: string, row: { packKey: string; categoryKey: string; starterPicks: string[]; setByType: string; setById: string | null }): Promise<StoredVendorPack>;
  abstract listVendorAddons(vendorId: string): Promise<StoredVendorAddon[]>;
  abstract setVendorAddon(vendorId: string, addonKey: string, status: 'ACTIVE' | 'ENDED', setBy: { type: string; id: string | null }): Promise<StoredVendorAddon>;
  abstract listVendorCapabilities(vendorId: string): Promise<StoredVendorCapability[]>;
  abstract setVendorCapability(vendorId: string, capabilityKey: string, enabled: boolean, source: string): Promise<StoredVendorCapability>;
}
