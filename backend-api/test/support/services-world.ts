import { EntitlementsService } from '../../src/plans/entitlements/entitlements.service';
import { TaxRateLite } from '../../src/v3-wallet/core/tax-core';
import { ServicesCatalogService } from '../../src/v3-services/services.service';
import { SERVICE_SEED } from '../../src/v3-services/seed/services-seed';
import { ServiceUsagePort } from '../../src/v3-services/services.store';
import { MemoryServicesStore } from './memory-services-store';
import { SUPER, walletWorld, WalletWorld } from './wallet-world';

/**
 * The wallet world plus the services twin joined to it (one unit of work covers a ledger entry and the pack it pays for), a controllable plan, a controllable allowance count and tax-rate rows that
 * exist ONLY in this test (the rates mean nothing: the code reads whatever rows it is given). The seller state is set so the tax rule can work; each test can take it away.
 */
export const OPS = { type: 'STAFF' as const, id: 'ops-1', ip: null };
export interface ServicesWorld extends WalletWorld {
  services: MemoryServicesStore; catalogue: ServicesCatalogService;
  plan: { level: 'PRO' | 'FREE' | null; subscriptionStatus: 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'CANCELLED' | null; suspended: boolean; track: string | null; features: Record<string, { state: string; limit: number | null }> };
  usage: { used: Record<string, number> };
  rates(): TaxRateLite[];
  /** put the twelve seeded services in the catalogue (words only; no price) */
  seed(): Promise<void>;
  /** propose then approve a price, effective now */
  price(serviceKey: string, amountPaise: number, over?: { taxInclusive?: boolean }): Promise<string>;
  pack(key: string, items: Array<{ serviceKey: string; count: number }>, amountPaise: number | null, over?: { validityDays?: number | null; status?: string }): Promise<string | null>;
}

export function servicesWorld(): ServicesWorld {
  const ww = walletWorld(); const store = new MemoryServicesStore(ww.store); store.clock = () => new Date(ww.now.t);
  const t0 = new Date('2026-01-01T00:00:00Z');
  const rates = (): TaxRateLite[] => [{ name: 'IGST', ratePercent: 18, appliesTo: 'ALL', active: true, validFrom: t0 }, { name: 'CGST', ratePercent: 9, appliesTo: 'ALL', active: true, validFrom: t0 }, { name: 'SGST', ratePercent: 9, appliesTo: 'ALL', active: true, validFrom: t0 }];
  store.taxes = rates();
  ww.wsettings.over = { ...ww.wsettings.over, walletSellerStateCode: '33' };
  const plan: ServicesWorld['plan'] = { level: 'PRO', subscriptionStatus: 'ACTIVE', suspended: false, track: 'handyman', features: {} };
  const usage = { used: {} as Record<string, number> };
  const entitlements = { resolve: async () => ({ level: plan.level, subscriptionStatus: plan.subscriptionStatus, suspended: plan.suspended, track: plan.track, features: plan.features }) } as unknown as EntitlementsService;
  const usagePort: ServiceUsagePort = { allowanceUsed: async (_v: string, k: string) => usage.used[k] ?? 0 };
  const catalogue = new ServicesCatalogService(store, ww.store, ww.svc, ww.settingsService, entitlements, usagePort, ww.bus); catalogue.clock = () => new Date(ww.now.t);
  const seed = async () => { for (const s of SERVICE_SEED) await store.unit((tx) => tx.insertService({ ...s, trackScope: [...s.trackScope] })); };
  const price = async (serviceKey: string, amountPaise: number, over: { taxInclusive?: boolean } = {}) => {
    const p = await catalogue.proposePrice('service', serviceKey, { amountPaise, taxInclusive: over.taxInclusive ?? false }, OPS);
    await catalogue.approvePrice('service', p.id, { effectiveFrom: new Date(ww.now.t).toISOString() }, SUPER); return p.id;
  };
  const pack = async (key: string, items: Array<{ serviceKey: string; count: number }>, amountPaise: number | null, over: { validityDays?: number | null; status?: string } = {}) => {
    await catalogue.createPack({ key, name: `Pack ${key}`, description: `Pack of services ${key}`, items, validityDays: over.validityDays ?? null, status: over.status ?? 'ACTIVE' }, OPS);
    if (amountPaise === null) return null;
    const p = await catalogue.proposePrice('pack', key, { amountPaise }, OPS);
    await catalogue.approvePrice('pack', p.id, { effectiveFrom: new Date(ww.now.t).toISOString() }, SUPER); return p.id;
  };
  return { ...ww, services: store, catalogue, plan, usage, rates, seed, price, pack };
}
