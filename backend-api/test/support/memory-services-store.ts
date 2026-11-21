import { Actor } from '../../src/plans/admin/audit.service';
import { TaxRateLite } from '../../src/v3-wallet/core/tax-core';
import { WalletTx } from '../../src/v3-wallet/wallet.store';
import {
  DuplicateError, NewPack, NewPrice, NewPurchase, NewService, PackPatch, PackRow, PricePatch, PriceRow, PurchaseRow, ServicePatch, ServiceRow, ServicesStore, ServicesTx,
} from '../../src/v3-services/services.store';
import { MemoryWalletStore } from './memory-wallet-store';

/**
 * In-memory twin of the Prisma services store. It enforces the unique rules the database enforces (service key, pack key, one price per service and start date, one purchase per vendor and key,
 * one purchase per ledger entry), and a unit of work that rolls everything back when its callback throws. Used alone for catalogue work, and joined to the wallet twin for pack purchases.
 */
export class MemoryServicesStore extends ServicesStore {
  serviceRows: ServiceRow[] = []; servicePriceRows: Array<PriceRow> = []; packRows: PackRow[] = []; packPriceRows: Array<PriceRow> = []; purchaseRows: PurchaseRow[] = [];
  taxes: TaxRateLite[] = []; audits: Array<{ actor: Actor; action: string; entityId: string | null; before: unknown; after: unknown }> = [];
  clock: () => Date = () => new Date();
  private n = 0; private chain: Promise<unknown> = Promise.resolve();
  constructor(readonly wallets: MemoryWalletStore) { super(); wallets.sidecars.push(this); }
  private id(p: string): string { return `${p}-${++this.n}`; }

  capture(): () => void {
    const s = { svc: this.serviceRows.map((x) => ({ ...x, trackScope: [...x.trackScope] })), sp: this.servicePriceRows.map((x) => ({ ...x })), pk: this.packRows.map((x) => ({ ...x, items: x.items.map((i) => ({ ...i })) })), pp: this.packPriceRows.map((x) => ({ ...x })), pu: this.purchaseRows.map((x) => ({ ...x, remaining: { ...x.remaining } })), au: this.audits.length };
    return () => { this.serviceRows = s.svc; this.servicePriceRows = s.sp; this.packRows = s.pk; this.packPriceRows = s.pp; this.purchaseRows = s.pu; this.audits.length = s.au; };
  }

  async unit<T>(fn: (tx: ServicesTx) => Promise<T>): Promise<T> {
    const run = this.chain.catch(() => undefined).then(async () => { const undo = this.capture(); try { return await fn(this.tx()); } catch (e) { undo(); throw e; } });
    this.chain = run.catch(() => undefined); return run;
  }
  withWallet<T>(vendorId: string, fn: (tx: ServicesTx, wallet: WalletTx) => Promise<T>): Promise<T> { return this.wallets.unit(vendorId, (wtx) => fn(this.tx(), wtx)); }

  private tx(): ServicesTx {
    const dup = (what: DuplicateError['what']): never => { throw new DuplicateError(what); };
    const copyP = (p: PriceRow): PriceRow => ({ ...p });
    return {
      services: async () => [...this.serviceRows].sort((a, b) => a.sortOrder - b.sortOrder || (a.key < b.key ? -1 : 1)).map((x) => ({ ...x, trackScope: [...x.trackScope] })),
      serviceByKey: async (key) => { const s = this.serviceRows.find((x) => x.key === key); return s ? { ...s, trackScope: [...s.trackScope] } : null; },
      servicePrices: async (sid) => this.servicePriceRows.filter((p) => p.ownerId === sid).map(copyP),
      allServicePrices: async () => this.servicePriceRows.filter((p) => p.status !== 'RETIRED').map(copyP),
      getServicePrice: async (id) => { const p = this.servicePriceRows.find((x) => x.id === id); return p ? copyP(p) : null; },
      packs: async () => [...this.packRows].sort((a, b) => (a.key < b.key ? -1 : 1)).map((x) => ({ ...x, items: x.items.map((i) => ({ ...i })) })),
      packByKey: async (key) => { const p = this.packRows.find((x) => x.key === key); return p ? { ...p, items: p.items.map((i) => ({ ...i })) } : null; },
      packPrices: async (pid) => this.packPriceRows.filter((p) => p.ownerId === pid).map(copyP),
      allPackPrices: async () => this.packPriceRows.filter((p) => p.status !== 'RETIRED').map(copyP),
      getPackPrice: async (id) => { const p = this.packPriceRows.find((x) => x.id === id); return p ? copyP(p) : null; },
      purchasesFor: async (v) => this.purchaseRows.filter((p) => p.vendorId === v).sort((a, b) => a.purchasedAt.getTime() - b.purchasedAt.getTime()).map((p) => ({ ...p, remaining: { ...p.remaining } })),
      purchaseByKey: async (v, k) => { const p = this.purchaseRows.find((x) => x.vendorId === v && x.idempotencyKey === k); return p ? { ...p, remaining: { ...p.remaining } } : null; },
      taxRates: async () => this.taxes.map((t) => ({ ...t })),

      insertService: async (d: NewService) => { if (this.serviceRows.some((s) => s.key === d.key)) dup('SERVICE_KEY'); const now = this.clock(); const row: ServiceRow = { ...d, trackScope: [...d.trackScope], id: this.id('svc'), createdAt: now, updatedAt: now }; this.serviceRows.push(row); return { ...row }; },
      updateService: async (id: string, patch: ServicePatch) => { const s = this.serviceRows.find((x) => x.id === id)!; Object.assign(s, patch, { updatedAt: this.clock() }); return { ...s, trackScope: [...s.trackScope] }; },
      insertServicePrice: async (d: NewPrice) => {
        if (d.effectiveFrom && this.servicePriceRows.some((p) => p.ownerId === d.ownerId && p.effectiveFrom?.getTime() === d.effectiveFrom!.getTime())) dup('PRICE_DATE');
        const now = this.clock(); const row: PriceRow = { ...d, id: this.id('sp'), status: 'PROPOSED', approvedBy: null, approvedAt: null, createdAt: now, updatedAt: now }; this.servicePriceRows.push(row); return copyP(row);
      },
      updateServicePrice: async (id, expected, patch: PricePatch) => {
        const p = this.servicePriceRows.find((x) => x.id === id); if (!p || !expected.includes(p.status)) return false;
        const date = patch.effectiveFrom !== undefined ? patch.effectiveFrom : p.effectiveFrom;
        if (date && this.servicePriceRows.some((x) => x.id !== id && x.ownerId === p.ownerId && x.effectiveFrom?.getTime() === date.getTime())) dup('PRICE_DATE');
        if ((patch.status ?? p.status) === 'APPROVED' && !(date && (patch.approvedBy ?? p.approvedBy))) throw new Error('check constraint: g4d_service_prices_approved_dated_chk');
        Object.assign(p, patch, { updatedAt: this.clock() }); return true;
      },
      insertPack: async (d: NewPack) => { if (this.packRows.some((s) => s.key === d.key)) dup('PACK_KEY'); const now = this.clock(); const row: PackRow = { ...d, items: d.items.map((i) => ({ ...i })), id: this.id('pack'), createdAt: now, updatedAt: now }; this.packRows.push(row); return { ...row, items: row.items.map((i) => ({ ...i })) }; },
      updatePack: async (id: string, patch: PackPatch) => { const p = this.packRows.find((x) => x.id === id)!; Object.assign(p, patch, { updatedAt: this.clock() }); return { ...p, items: p.items.map((i) => ({ ...i })) }; },
      insertPackPrice: async (d: NewPrice) => {
        if (d.effectiveFrom && this.packPriceRows.some((p) => p.ownerId === d.ownerId && p.effectiveFrom?.getTime() === d.effectiveFrom!.getTime())) dup('PRICE_DATE');
        const now = this.clock(); const row: PriceRow = { ...d, id: this.id('pp'), status: 'PROPOSED', approvedBy: null, approvedAt: null, createdAt: now, updatedAt: now }; this.packPriceRows.push(row); return copyP(row);
      },
      updatePackPrice: async (id, expected, patch: PricePatch) => {
        const p = this.packPriceRows.find((x) => x.id === id); if (!p || !expected.includes(p.status)) return false;
        const date = patch.effectiveFrom !== undefined ? patch.effectiveFrom : p.effectiveFrom;
        if (date && this.packPriceRows.some((x) => x.id !== id && x.ownerId === p.ownerId && x.effectiveFrom?.getTime() === date.getTime())) dup('PRICE_DATE');
        Object.assign(p, patch, { updatedAt: this.clock() }); return true;
      },
      insertPurchase: async (d: NewPurchase) => {
        if (this.purchaseRows.some((p) => (p.vendorId === d.vendorId && p.idempotencyKey === d.idempotencyKey) || p.ledgerEntryId === d.ledgerEntryId)) dup('PURCHASE');
        const row: PurchaseRow = { ...d, remaining: { ...d.remaining }, id: this.id('pur') }; this.purchaseRows.push(row); return { ...row, remaining: { ...row.remaining } };
      },
      updatePurchaseRemaining: async (id, expected, next) => { const p = this.purchaseRows.find((x) => x.id === id); if (!p || JSON.stringify(p.remaining) !== JSON.stringify(expected)) return false; p.remaining = { ...next }; return true; },
      audit: async (actor, action, entityId, before, after) => { this.audits.push({ actor, action, entityId, before, after }); },
    };
  }

  // reads straight from the rows (no unit)
  services() { return this.tx().services(); }
  serviceByKey(key: string) { return this.tx().serviceByKey(key); }
  servicePrices(id: string) { return this.tx().servicePrices(id); }
  allServicePrices() { return this.tx().allServicePrices(); }
  getServicePrice(id: string) { return this.tx().getServicePrice(id); }
  packs() { return this.tx().packs(); }
  packByKey(key: string) { return this.tx().packByKey(key); }
  packPrices(id: string) { return this.tx().packPrices(id); }
  allPackPrices() { return this.tx().allPackPrices(); }
  getPackPrice(id: string) { return this.tx().getPackPrice(id); }
  purchasesFor(v: string) { return this.tx().purchasesFor(v); }
  purchaseByKey(v: string, k: string) { return this.tx().purchaseByKey(v, k); }
  taxRates() { return this.tx().taxRates(); }
}
