import { OtpPepper } from '../../src/directory/pepper';
import { Actor } from '../../src/plans/admin/audit.service';
import { ServicesTx } from '../../src/v3-services/services.store';
import { WalletTx } from '../../src/v3-wallet/wallet.store';
import { PriorSwitch, SwitchStatus } from '../../src/v3-theme-switch/core/theme-switch-core';
import { Eligibility, FieldUse, PreviewResult, SitePipelinePort, SiteSnapshot } from '../../src/v3-theme-switch/site-pipeline.port';
import { ThemeSwitchService } from '../../src/v3-theme-switch/theme-switch.service';
import { DuplicateSwitchError, NewSwitch, SwitchPatch, SwitchRow, SwitchTx, ThemeSwitchStore } from '../../src/v3-theme-switch/theme-switch.store';
import { MemoryServiceRequestsStore } from './memory-service-requests-store';
import { MemoryServicesStore } from './memory-services-store';
import { requestsWorld, RequestsWorld } from './service-requests-world';

/** In-memory twin of the Prisma theme switch store: one row per vendor and key, the paid-needs-funding and gift-needs-reason checks, and rollback together with the wallet and services twins. */
export class MemoryThemeSwitchStore extends ThemeSwitchStore {
  rows: SwitchRow[] = []; audits: Array<{ action: string; entityId: string | null; after: unknown }> = []; clock: () => Date = () => new Date(); private n = 0;
  constructor(readonly services: MemoryServicesStore, readonly requests: MemoryServiceRequestsStore) { super(); services.wallets.sidecars.push(this); }
  capture(): () => void { const s = { rows: this.rows.map((r) => ({ ...r, hiddenFields: [...r.hiddenFields] })), au: this.audits.length }; return () => { this.rows = s.rows; this.audits.length = s.au; }; }
  unit<T>(vendorId: string, fn: (t: SwitchTx, s: ServicesTx, w: WalletTx) => Promise<T>): Promise<T> { return this.services.withWallet(vendorId, (stx, wtx) => fn(this.tx(vendorId), stx, wtx)); }
  private tx(vendorId: string): SwitchTx {
    const cp = (r: SwitchRow): SwitchRow => ({ ...r, hiddenFields: [...r.hiddenFields], taxSnapshot: { ...r.taxSnapshot } });
    return {
      insert: async (d: NewSwitch) => {
        if (this.rows.some((r) => r.vendorId === d.vendorId && r.idempotencyKey === d.idempotencyKey) || (d.ledgerEntryId && this.rows.some((r) => r.ledgerEntryId === d.ledgerEntryId))) throw new DuplicateSwitchError();
        if (d.kind === 'PAID' ? !(d.ledgerEntryId || d.packPurchaseId || d.serviceRequestId) : (d.ledgerEntryId || d.packPurchaseId)) throw new Error('check constraint: g4d_theme_switches_paid_chk');
        if (d.kind === 'COMPLIMENTARY_STAFF' && !(d.reason && d.reason.length >= 5)) throw new Error('check constraint: g4d_theme_switches_gift_reason_chk');
        const now = this.clock(); const row: SwitchRow = { ...d, publicationId: null, failureReason: null, createdAt: now, updatedAt: now }; this.rows.push(row); return cp(row);
      },
      findByKey: async (key) => { const r = this.rows.find((x) => x.vendorId === vendorId && x.idempotencyKey === key); return r ? cp(r) : null; },
      get: async (id) => { const r = this.rows.find((x) => x.id === id && x.vendorId === vendorId); return r ? cp(r) : null; },
      updateCas: async (id, expected: SwitchStatus[], patch: SwitchPatch) => { const r = this.rows.find((x) => x.id === id && x.vendorId === vendorId); if (!r || !expected.includes(r.status)) return false; Object.assign(r, patch, { updatedAt: this.clock() }); return true; },
      priors: async () => this.rows.filter((r) => r.vendorId === vendorId).map((r) => ({ kind: r.kind, status: r.status })),
      requestCarriesFee: async (requestId, toThemeKey) => { const r = this.requests.requests.find((x) => x.id === requestId && x.vendorId === vendorId && x.serviceKey === 'THEME_SWITCH' && ['ACCEPTED', 'IN_PRODUCTION', 'READY_FOR_REVIEW', 'REVISION_REQUESTED'].includes(x.status)); return !!r && r.brief.themeKey === toThemeKey; },
      audit: async (_a: Actor, action, entityId, _b, after) => { this.audits.push({ action, entityId, after }); },
    };
  }
  async findByKey(vendorId: string, key: string) { const r = this.rows.find((x) => x.vendorId === vendorId && x.idempotencyKey === key); return r ? { ...r, hiddenFields: [...r.hiddenFields] } : null; }
  async priors(vendorId: string): Promise<PriorSwitch[]> { return this.rows.filter((r) => r.vendorId === vendorId).map((r) => ({ kind: r.kind, status: r.status })); }
  async listForVendor(vendorId: string, skip: number, take: number) { const all = this.rows.filter((r) => r.vendorId === vendorId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); return { items: all.slice(skip, skip + take).map((r) => ({ ...r })), total: all.length }; }
  async stalePending(before: Date, limit: number) { return this.rows.filter((r) => r.status === 'PENDING' && r.updatedAt < before).slice(0, limit).map((r) => ({ ...r })); }
  newId(): string { return `sw-${++this.n}`; }
}

/** A site pipeline the tests control: which themes are allowed, what is stored and published, which fields a theme draws, and where an apply fails. Publications are kept, so a rollback target always exists. */
export class FakeSitePipeline extends SitePipelinePort {
  vendors = new Map<string, { stored: string | null; published: string | null; has: boolean; pubs: Array<{ id: string; theme: string }> }>();
  allowed = new Set(['standard-a', 'pro-b', 'pro-c', 'pro-d']); content = ['site', 'items', 'faqs', 'team', 'testimonials'];
  uses: Record<string, string[] | null> = { 'standard-a': ['site', 'items'], 'pro-b': ['site', 'items', 'faqs', 'team', 'testimonials'], 'pro-c': ['site', 'items', 'faqs'], 'pro-d': null };
  fail: 'none' | 'before' | 'after-set' | 'publish' = 'none'; canUseStored = true;
  calls = { apply: 0, preview: 0, setStored: 0, restore: 0 }; private n = 0;
  private v(id: string) { let s = this.vendors.get(id); if (!s) { s = { stored: 'standard-a', published: 'standard-a', has: true, pubs: [{ id: 'pub-0', theme: 'standard-a' }] }; this.vendors.set(id, s); } return s; }
  async snapshot(id: string): Promise<SiteSnapshot> { const s = this.v(id); return { storedThemeId: s.stored, publishedThemeId: s.published, hasPublished: s.has }; }
  async eligibility(_id: string, t: string): Promise<Eligibility> { return this.allowed.has(t) ? { ok: true } : { ok: false, code: 'THEME_INVALID', message: 'That theme is not available.' }; }
  async fieldsFor(_id: string, t: string): Promise<FieldUse> { return { contentFields: [...this.content], usedFields: this.uses[t] ?? null }; }
  async preview(id: string, t: string): Promise<PreviewResult> { this.calls.preview++; return { html: `<main data-theme="${t}">${this.v(id).stored}</main>`, css: '.x{}', warnings: [], ...(await this.fieldsFor(id, t)) }; }
  async apply(id: string, t: string, _a: Actor) {
    this.calls.apply++; const s = this.v(id);
    if (this.fail === 'before') throw new Error('settings write failed');
    s.stored = t;
    if (this.fail === 'after-set') throw new Error('build failed');
    if (!s.has) return { publicationId: null };
    if (this.fail === 'publish') throw new Error('publish failed');
    const pub = { id: `pub-${++this.n}`, theme: t }; s.pubs.push(pub); s.published = t; return { publicationId: pub.id };
  }
  async setStored(id: string, t: string | null) { this.calls.setStored++; this.v(id).stored = t; }
  async restore(id: string, _a: Actor) {
    this.calls.restore++; const s = this.v(id);
    if (!s.has || !s.stored || s.stored === s.published || !this.canUseStored) return null;
    const pub = { id: `pub-${++this.n}`, theme: s.stored }; s.pubs.push(pub); s.published = s.stored; return { publicationId: pub.id, themeId: s.stored };
  }
}

export const THEME_FEE_BASE = 29_900; export const THEME_FEE_TOTAL = 29_900;   // the test's own price (set below); using credit carries no tax (GST was added at the refill), so the charge is exactly the price
export interface ThemeWorld extends RequestsWorld { themes: ThemeSwitchService; themeStore: MemoryThemeSwitchStore; pipe: FakeSitePipeline; vendorBy(id?: string): { type: 'VENDOR'; actor: Actor; funding: 'WALLET' }; ensureFee(): Promise<void> }

export function themeWorld(): ThemeWorld {
  const w = requestsWorld(); const themeStore = new MemoryThemeSwitchStore(w.services, w.requests); themeStore.clock = () => new Date(w.now.t);
  const pipe = new FakeSitePipeline();
  const themes = new ThemeSwitchService(themeStore, pipe, w.services, w.svc, w.store, w.settingsService, w.entitlements, new OtpPepper(), w.bus); themes.clock = () => new Date(w.now.t);
  const vendorBy = (id = 'v1') => ({ type: 'VENDOR' as const, actor: { type: 'VENDOR' as const, id, ip: null }, funding: 'WALLET' as const });
  const ensureFee = async () => { await w.price('THEME_SWITCH', THEME_FEE_BASE); };
  return { ...w, themes, themeStore, pipe, vendorBy, ensureFee };
}
