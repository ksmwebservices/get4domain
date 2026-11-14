import { Injectable, Optional } from '@nestjs/common';
import { ActivityService } from '../v3-activity/activity.service';
import { KeyedQueue } from '../common/keyed-queue';
import { EntitlementsService } from '../plans/entitlements/entitlements.service';
import { capabilityAnswer, CapabilityAnswer, NavInput, NavTab, NavTabDef, resolveNav, tabAccess, TabAccess } from './core/nav-core';
import { checkPackConfig, checkTab, isTier, TabInput, Tier, TIERS } from './core/pack-core';
import { packError } from './pack.errors';
import {
  PackReferenceStore, PackVendorStore, StoredAddon, StoredCapability, StoredCategory, StoredMatrixCell, StoredPack, StoredTab,
} from './pack-engine.store';

/** The two switches of the engine, both default OFF. Stored in g4d_plan_settings; only SUPER_ADMIN changes them. */
export const PACK_SETTING_KEYS = {
  /** opens the pack tabs of the health, legal and finance packs once counsel has signed off */
  gatedPacksOpen: 'packGatedPacksOpen',
  /** online medicine checkout of the Pharmacy pack: OFF until counsel decides (Amendment 13 V3A) */
  onlineMedicineCheckout: 'packOnlineMedicineCheckout',
} as const;

export interface PackActor { type: 'VENDOR' | 'STAFF' | 'SYSTEM'; id: string | null; ip?: string | null }
export const PACK_CACHE_TTL_MS = 15_000;

interface Reference {
  packs: StoredPack[]; tabs: StoredTab[]; capabilities: StoredCapability[]; matrix: StoredMatrixCell[]; categories: StoredCategory[]; addons: StoredAddon[];
  gatedPacksOpen: boolean; onlineMedicineCheckout: boolean;
}

export interface NavigationResult {
  mode: NavInput['mode']; level: 'FREE' | 'PRO' | null; tier: Tier | null; plan: string | null;
  /** PAUSED while staff have paused the paid plan, otherwise the subscription status (Amendment 13 B13) */
  planState: string | null; paused: boolean;
  pack: { key: string; name: string; disclaimerKey: string | null } | null;
  /** ON only when SUPER_ADMIN has switched it on; OFF by default */
  flags: { onlineMedicineCheckout: boolean };
  tabs: NavTab[];
}

/**
 * The pack engine (Amendment 13 Part A). It loads the data (packs, tabs, capabilities, the tier matrix, the category map, the add-on packs), asks the Stage 5.1 entitlement engine which plan applies now
 * (never redoing that arithmetic), and hands the facts to the pure navigation core. Reads are kept 15 seconds in process memory and forgotten after every staff write.
 * A vendor's own writes go through a per-vendor KeyedQueue that is opened BEFORE any database work, never inside a transaction. Every change writes an activity row.
 */
@Injectable()
export class PackEngineService {
  private ref: { at: number; data: Reference } | null = null;
  private readonly queue = new KeyedQueue();
  clock: () => number = () => Date.now();

  constructor(
    private readonly refs: PackReferenceStore, private readonly vendors: PackVendorStore, private readonly entitlements: EntitlementsService,
    @Optional() private readonly activity?: ActivityService,
  ) {}

  invalidate(): void { this.ref = null; }

  private async reference(): Promise<Reference> {
    const now = this.clock();
    if (this.ref && now - this.ref.at < PACK_CACHE_TTL_MS) return this.ref.data;
    const [packs, tabs, capabilities, matrix, categories, addons, gatedPacksOpen, onlineMedicineCheckout] = await Promise.all([
      this.refs.listPacks(), this.refs.listTabs(), this.refs.listCapabilities(), this.refs.listMatrix(), this.refs.listCategories(), this.refs.listAddons(),
      this.refs.getSettingBool(PACK_SETTING_KEYS.gatedPacksOpen), this.refs.getSettingBool(PACK_SETTING_KEYS.onlineMedicineCheckout),
    ]);
    const data = { packs, tabs, capabilities, matrix, categories, addons, gatedPacksOpen, onlineMedicineCheckout };
    this.ref = { at: now, data };
    return data;
  }

  private matrixOf(r: Reference): Map<Tier, Set<string>> {
    const m = new Map<Tier, Set<string>>(TIERS.map((t) => [t, new Set<string>()]));
    for (const c of r.matrix) if (c.allowed) m.get(c.tier)?.add(c.capabilityKey);
    return m;
  }

  private async record(actor: PackActor, vendorId: string | null, actionKey: string, entityType: string, entityId: string, summary: Record<string, unknown>): Promise<void> {
    await this.activity?.record({ vendorId, actor: { type: actor.type, id: actor.id, ip: actor.ip ?? null }, actionKey, entityType, entityId, summary });
  }

  // ── the vendor's tab list (A4) ──────────────────────────────────────────────────────────────────

  async navigation(vendorId: string): Promise<NavigationResult> {
    const [r, resolved, vp, vcaps, vaddons] = await Promise.all([
      this.reference(), this.entitlements.resolve(vendorId), this.vendors.getVendorPack(vendorId), this.vendors.listVendorCapabilities(vendorId), this.vendors.listVendorAddons(vendorId),
    ]);
    const pack = vp ? r.packs.find((p) => p.key === vp.packKey && p.enabled) ?? null : null;
    const activeAddons = new Set(vaddons.filter((a) => a.status === 'ACTIVE').map((a) => a.addonKey));
    const grants = new Set(r.addons.filter((a) => activeAddons.has(a.key) && a.enabled).flatMap((a) => a.grantsCapabilities));
    const tier = isTier(resolved.track) ? resolved.track : null;
    const level = resolved.level === 'FREE' || resolved.level === 'PRO' ? resolved.level : null;
    const defs: NavTabDef[] = r.tabs.filter((t) => t.active).map((t) => ({ scope: t.scope, ownerKey: t.ownerKey, key: t.key, label: t.label, route: t.route, minTier: t.minTier, capabilityKey: t.capabilityKey, freeTrial: t.freeTrial, sortOrder: t.sortOrder }));
    const tabs = resolveNav({
      mode: resolved.mode, level, tier, tabs: defs,
      pack: pack ? { key: pack.key, counselGated: (pack.config as { flags?: { counselGated?: boolean } } | null)?.flags?.counselGated === true } : null,
      gatedPacksOpen: r.gatedPacksOpen, matrix: this.matrixOf(r), held: new Set(vcaps.filter((c) => c.enabled).map((c) => c.capabilityKey)),
      addons: activeAddons, addonGrants: grants, paused: resolved.paused === true,
    });
    return {
      mode: resolved.mode, level, tier, plan: resolved.plan, planState: resolved.planState ?? resolved.subscriptionStatus ?? null, paused: resolved.paused === true,
      pack: pack ? { key: pack.key, name: pack.name, disclaimerKey: pack.disclaimerKey } : null,
      flags: { onlineMedicineCheckout: pack?.key === 'PHARMACY' && r.onlineMedicineCheckout },
      tabs,
    };
  }

  // ── the paused plan state (Amendment 13 B13) ───────────────────────────────────────────────────

  /**
   * Staff pause a vendor's PAID plan. While paused the vendor sees the Free trial tabs ACTIVE and every other tab locked (reason PLAN_PAUSED); nothing is deleted, and the subscription row and its term are
   * not touched (whether a pause stops or extends the paid term is the owner's rule, not built here). Only a paid plan that applies now can be paused.
   */
  async pausePlan(vendorId: string, reason: string, actor: PackActor): Promise<{ paused: true; pausedAt: Date }> {
    return this.queue.run(`pack:${vendorId}`, async () => {
      const resolved = await this.entitlements.resolve(vendorId);
      if (resolved.paused === true) throw packError(409, 'PLAN_ALREADY_PAUSED', 'This plan is already paused.');
      if (resolved.mode !== 'V3' || resolved.level !== 'PRO') throw packError(409, 'PLAN_NOT_PAUSABLE', 'Only a paid plan that is running can be paused.');
      const row = await this.vendors.openPause(vendorId, reason.trim(), { type: actor.type, id: actor.id });
      if (!row) throw packError(409, 'PLAN_ALREADY_PAUSED', 'This plan is already paused.');
      this.entitlements.invalidate(vendorId);
      await this.record(actor, vendorId, 'plan.paused', 'PlanPause', vendorId, { reason: reason.trim() });
      return { paused: true, pausedAt: row.pausedAt };
    });
  }
  async resumePlan(vendorId: string, actor: PackActor): Promise<{ paused: false }> {
    return this.queue.run(`pack:${vendorId}`, async () => {
      if (!(await this.vendors.closePause(vendorId, { type: actor.type, id: actor.id }))) throw packError(409, 'PLAN_NOT_PAUSED', 'This plan is not paused.');
      this.entitlements.invalidate(vendorId);
      await this.record(actor, vendorId, 'plan.resumed', 'PlanPause', vendorId, {});
      return { paused: false };
    });
  }

  /** The server-side answer behind every locked tab: may this vendor use the routes of this tab? (Memoised per request by the guard.) */
  async access(vendorId: string, tabKey: string): Promise<TabAccess> {
    const n = await this.navigation(vendorId);
    return tabAccess(n.mode, n.tabs, tabKey);
  }

  // ── add-on packs a vendor can see (Amendment 13 V3A, B10) ────────────────────────────────────────

  /**
   * Every enabled add-on pack with whether it is on for this vendor and whether the vendor's category offers it. The price is ALWAYS reported as PENDING with no number until the owner sets it in the
   * price book (an add-on has no price column), so a screen shows "price not set" and never a figure.
   */
  async myAddons(vendorId: string): Promise<Array<{ key: string; name: string; description: string | null; grantsCapabilities: string[]; active: boolean; offered: boolean; bundleDiscount: boolean; priceStatus: 'PENDING'; price: null; priceNote: string }>> {
    const [r, vp, vaddons] = await Promise.all([this.reference(), this.vendors.getVendorPack(vendorId), this.vendors.listVendorAddons(vendorId)]);
    const cat = vp ? r.categories.find((c) => c.categoryKey === vp.categoryKey) : undefined;
    const offered = new Map((cat?.addonPacks ?? []).map((a) => [a.key, a.bundleDiscount] as const));
    const on = new Set(vaddons.filter((a) => a.status === 'ACTIVE').map((a) => a.addonKey));
    return r.addons.filter((a) => a.enabled).map((a) => ({
      key: a.key, name: a.name, description: a.description, grantsCapabilities: a.grantsCapabilities, active: on.has(a.key), offered: offered.has(a.key), bundleDiscount: offered.get(a.key) === true,
      priceStatus: 'PENDING' as const, price: null, priceNote: 'Price not set',
    }));
  }

  /** Is this key one of the engine's add-on packs (as opposed to a wallet usage pack of the price book)? */
  async isAddonKey(key: string): Promise<boolean> { return (await this.reference()).addons.some((a) => a.key === key && a.enabled); }

  /** Buying an add-on pack: while its price is PENDING nothing is sold and no number is shown. A pack the vendor's category does not offer is not found. */
  async refuseAddonPurchase(vendorId: string, key: string): Promise<never> {
    const mine = (await this.myAddons(vendorId)).find((a) => a.key === key);
    if (!mine || (!mine.offered && !mine.active)) throw packError(404, 'PACK_NOT_FOUND', 'That add-on pack is not available for your kind of business.');
    throw packError(409, 'ADDON_PRICE_PENDING', 'This add-on pack cannot be bought yet. Its price has not been set.', { addon: key, priceStatus: 'PENDING' });
  }

  // ── registration and capabilities (A5) ──────────────────────────────────────────────────────────

  /** The categories a business can pick on the registration form (no pack detail, no money). */
  async categories(): Promise<Array<{ categoryKey: string; name: string; family: string; packKey: string; minTier: Tier }>> {
    const r = await this.reference();
    return r.categories.filter((c) => c.active).map((c) => ({ categoryKey: c.categoryKey, name: c.name, family: c.family, packKey: c.packKey, minTier: c.minTier }));
  }

  private category(r: Reference, key: string): StoredCategory {
    const c = r.categories.find((x) => x.categoryKey === key && x.active);
    if (!c) throw packError(404, 'PACK_CATEGORY_UNKNOWN', 'That category does not exist.');
    return c;
  }

  /** What registration shows after the category is picked: the pack, the tier (the category minimum), the starter services to pick from, and for every capability the category lists whether the tier has it. */
  async offer(categoryKey: string): Promise<{
    categoryKey: string; name: string; pack: { key: string; name: string; disclaimerKey: string | null }; tier: Tier; starterServices: string[]; needsBlueprint: boolean; statusNote: string | null;
    capabilities: Array<{ key: string; name: string; included: boolean; needsTier: Tier | null }>; addonPacks: Array<{ key: string; name: string; bundleDiscount: boolean; priceStatus: 'PENDING' }>;
  }> {
    const r = await this.reference();
    const c = this.category(r, categoryKey);
    const pack = r.packs.find((p) => p.key === c.packKey);
    if (!pack || !pack.enabled) throw packError(404, 'PACK_NOT_FOUND', 'That category has no pack yet.');
    const matrix = this.matrixOf(r); const known = new Set(r.capabilities.map((x) => x.key));
    return {
      categoryKey: c.categoryKey, name: c.name, pack: { key: pack.key, name: pack.name, disclaimerKey: pack.disclaimerKey }, tier: c.minTier, starterServices: c.starterServices, needsBlueprint: c.needsBlueprint, statusNote: c.statusNote,
      capabilities: c.optionalCapabilities.map((k) => {
        const a = capabilityAnswer(c.minTier, k, known, matrix);
        return { key: k, name: r.capabilities.find((x) => x.key === k)?.name ?? k, included: a.ok, needsTier: a.ok || a.code !== 'NEEDS_TIER' ? null : a.needsTier };
      }),
      addonPacks: c.addonPacks.flatMap((a) => { const d = r.addons.find((x) => x.key === a.key && x.enabled); return d ? [{ key: d.key, name: d.name, bundleDiscount: a.bundleDiscount, priceStatus: 'PENDING' as const }] : []; }),
    };
  }

  private needsTier(a: Extract<CapabilityAnswer, { ok: false }>, capability: string): never {
    if (a.code === 'UNKNOWN_CAPABILITY') throw packError(400, 'PACK_CAPABILITY_UNKNOWN', 'That capability does not exist.', { capability });
    throw packError(403, 'CAPABILITY_NEEDS_TIER', a.needsTier ? 'This needs a higher plan tier.' : 'This is not part of any plan tier yet.', { capability, needsTier: a.needsTier });
  }

  /**
   * Registration: the category sets the ONE primary pack (it never changes with the tier), the vendor picks starter services from the category's list and any capabilities the tier allows.
   * A capability above the tier answers CAPABILITY_NEEDS_TIER and names the tier. Repeating the same category only updates the picks; a different category is refused (staff move a vendor).
   */
  async register(vendorId: string, input: { categoryKey: string; starterServices?: string[]; capabilities?: string[] }, actor: PackActor): Promise<{ packKey: string; categoryKey: string; tier: Tier; starterServices: string[]; capabilities: string[] }> {
    return this.queue.run(`pack:${vendorId}`, async () => {
      const r = await this.reference();
      const c = this.category(r, input.categoryKey);
      const pack = r.packs.find((p) => p.key === c.packKey && p.enabled);
      if (!pack) throw packError(404, 'PACK_NOT_FOUND', 'That category has no pack yet.');
      const existing = await this.vendors.getVendorPack(vendorId);
      if (existing && existing.categoryKey !== c.categoryKey) throw packError(409, 'PACK_ALREADY_SET', 'This business already has a category. Ask support to change it.');
      const picks = [...new Set(input.starterServices ?? [])];
      const offered = new Set(c.starterServices);
      const bad = picks.filter((p) => !offered.has(p));
      if (bad.length) throw packError(400, 'PACK_STARTER_UNKNOWN', 'Some starter services are not offered for this category.', { unknown: bad });
      const matrix = this.matrixOf(r); const known = new Set(r.capabilities.map((x) => x.key));
      const caps = [...new Set(input.capabilities ?? [])];
      for (const k of caps) { const a = capabilityAnswer(c.minTier, k, known, matrix); if (!a.ok) this.needsTier(a, k); }
      await this.vendors.setVendorPack(vendorId, { packKey: pack.key, categoryKey: c.categoryKey, starterPicks: picks, setByType: actor.type, setById: actor.id });
      for (const k of caps) await this.vendors.setVendorCapability(vendorId, k, true, 'REGISTRATION');
      await this.record(actor, vendorId, existing ? 'pack.picks.changed' : 'pack.registered', 'VendorPack', vendorId, { packKey: pack.key, categoryKey: c.categoryKey, starterCount: picks.length, capabilities: caps });
      return { packKey: pack.key, categoryKey: c.categoryKey, tier: c.minTier, starterServices: picks, capabilities: caps };
    });
  }

  /** Every capability with whether the vendor holds it and whether their tier (or an active add-on) allows it. */
  async myCapabilities(vendorId: string): Promise<Array<{ key: string; name: string; held: boolean; allowed: boolean; needsTier: Tier | null }>> {
    const [r, resolved, vcaps, vaddons] = await Promise.all([this.reference(), this.entitlements.resolve(vendorId), this.vendors.listVendorCapabilities(vendorId), this.vendors.listVendorAddons(vendorId)]);
    const tier = await this.tierOf(vendorId, resolved.track);
    const grants = this.grantsOf(r, vaddons);
    const matrix = this.matrixOf(r); const known = new Set(r.capabilities.map((x) => x.key));
    return r.capabilities.filter((c) => c.active).map((c) => {
      const a = capabilityAnswer(tier, c.key, known, matrix, grants);
      return { key: c.key, name: c.name, held: vcaps.some((v) => v.capabilityKey === c.key && v.enabled), allowed: a.ok, needsTier: a.ok || a.code !== 'NEEDS_TIER' ? null : a.needsTier };
    });
  }

  private grantsOf(r: Reference, vaddons: Array<{ addonKey: string; status: string }>): Set<string> {
    const on = new Set(vaddons.filter((a) => a.status === 'ACTIVE').map((a) => a.addonKey));
    return new Set(r.addons.filter((a) => on.has(a.key) && a.enabled).flatMap((a) => a.grantsCapabilities));
  }

  /** The tier the vendor is judged at: the plan track that applies now; a vendor with no plan yet is judged at their category's minimum. */
  private async tierOf(vendorId: string, track: string | null): Promise<Tier | null> {
    if (isTier(track)) return track;
    const vp = await this.vendors.getVendorPack(vendorId);
    const c = vp ? (await this.reference()).categories.find((x) => x.categoryKey === vp.categoryKey) : undefined;
    return c?.minTier ?? null;
  }

  /** Switch a capability on or off. Switching on above the tier answers CAPABILITY_NEEDS_TIER. Switching off only hides the tab: every record is kept. */
  async setCapability(vendorId: string, key: string, enabled: boolean, actor: PackActor): Promise<{ key: string; enabled: boolean }> {
    return this.queue.run(`pack:${vendorId}`, async () => {
      const r = await this.reference();
      if (enabled) {
        const [resolved, vaddons] = await Promise.all([this.entitlements.resolve(vendorId), this.vendors.listVendorAddons(vendorId)]);
        const a = capabilityAnswer(await this.tierOf(vendorId, resolved.track), key, new Set(r.capabilities.map((x) => x.key)), this.matrixOf(r), this.grantsOf(r, vaddons));
        if (!a.ok) this.needsTier(a, key);
      } else if (!r.capabilities.some((c) => c.key === key)) throw packError(400, 'PACK_CAPABILITY_UNKNOWN', 'That capability does not exist.', { capability: key });
      await this.vendors.setVendorCapability(vendorId, key, enabled, actor.type === 'STAFF' ? 'STAFF' : 'VENDOR');
      await this.record(actor, vendorId, enabled ? 'pack.capability.on' : 'pack.capability.off', 'VendorCapability', key, { capability: key });
      return { key, enabled };
    });
  }

  // ── staff: view and edit the data (A6) ──────────────────────────────────────────────────────────

  async adminPacks(): Promise<StoredPack[]> { return (await this.reference()).packs; }
  async adminPack(key: string): Promise<{ pack: StoredPack; tabs: StoredTab[]; categories: number }> {
    const r = await this.reference();
    const pack = r.packs.find((p) => p.key === key);
    if (!pack) throw packError(404, 'PACK_NOT_FOUND', 'That pack does not exist.');
    return { pack, tabs: r.tabs.filter((t) => t.scope === 'PACK' && t.ownerKey === key), categories: r.categories.filter((c) => c.packKey === key).length };
  }
  async editPack(key: string, patch: { name?: string; enabled?: boolean; disclaimerKey?: string | null; reviewStatus?: string; config?: unknown }, actor: PackActor): Promise<StoredPack> {
    if (patch.config !== undefined) { const problems = checkPackConfig(patch.config); if (problems.length) throw packError(400, 'PACK_INVALID', 'The pack is not valid.', { problems }); }
    const row = await this.refs.updatePack(key, patch, actor.id);
    if (!row) throw packError(404, 'PACK_NOT_FOUND', 'That pack does not exist.');
    this.invalidate();
    await this.record(actor, null, 'pack.edited', 'Pack', key, { fields: Object.keys(patch) });
    return row;
  }
  async adminTabs(): Promise<StoredTab[]> { return (await this.reference()).tabs; }
  async saveTab(input: TabInput & { active?: boolean }, actor: PackActor): Promise<StoredTab> {
    const r = await this.reference();
    const problems = checkTab(input, { packs: new Set(r.packs.map((p) => p.key)), capabilities: new Set(r.capabilities.map((c) => c.key)), addons: new Set(r.addons.map((a) => a.key)) });
    if (problems.length) throw packError(400, 'PACK_INVALID', 'The tab is not valid.', { problems });
    const row = await this.refs.upsertTab({
      scope: input.scope as StoredTab['scope'], ownerKey: input.ownerKey, key: input.key, label: input.label.trim(), route: input.route, minTier: input.minTier && isTier(input.minTier) ? input.minTier : null,
      capabilityKey: input.capabilityKey ?? null, freeTrial: input.freeTrial === true, sortOrder: input.sortOrder ?? 0, active: input.active !== false,
    }, actor.id);
    this.invalidate();
    await this.record(actor, null, 'pack.tab.saved', 'PackTab', `${input.scope}:${input.ownerKey}:${input.key}`, { active: row.active, freeTrial: row.freeTrial });
    return row;
  }
  async adminMatrix(): Promise<{ capabilities: StoredCapability[]; cells: StoredMatrixCell[] }> { const r = await this.reference(); return { capabilities: r.capabilities, cells: r.matrix }; }
  /** SUPER_ADMIN only (the route's matrix entry). Changing a cell changes what a tier allows from the next read; nothing a vendor holds is deleted. */
  async setMatrixCell(tier: string, capabilityKey: string, allowed: boolean, actor: PackActor): Promise<StoredMatrixCell> {
    if (!isTier(tier)) throw packError(400, 'PACK_MATRIX_INVALID', 'That tier does not exist.');
    const cell = await this.refs.setMatrixCell(tier, capabilityKey, allowed, actor.id);
    if (!cell) throw packError(400, 'PACK_CAPABILITY_UNKNOWN', 'That capability does not exist.', { capability: capabilityKey });
    this.invalidate();
    await this.record(actor, null, 'pack.matrix.changed', 'TierCapability', `${tier}:${capabilityKey}`, { tier, capabilityKey, allowed });
    return cell;
  }
  async adminCategories(): Promise<StoredCategory[]> { return (await this.reference()).categories; }
  async editCategory(categoryKey: string, patch: { packKey?: string; minTier?: string; optionalCapabilities?: string[]; starterServices?: string[]; active?: boolean; ownerNotes?: string | null }, actor: PackActor): Promise<StoredCategory> {
    const r = await this.reference();
    if (patch.packKey !== undefined && !r.packs.some((p) => p.key === patch.packKey)) throw packError(400, 'PACK_NOT_FOUND', 'That pack does not exist.');
    if (patch.minTier !== undefined && !isTier(patch.minTier)) throw packError(400, 'PACK_INVALID', 'That tier does not exist.');
    const caps = new Set(r.capabilities.map((c) => c.key));
    const badCap = (patch.optionalCapabilities ?? []).filter((k) => !caps.has(k));
    if (badCap.length) throw packError(400, 'PACK_CAPABILITY_UNKNOWN', 'Some capabilities do not exist.', { unknown: badCap });
    const row = await this.refs.updateCategory(categoryKey, { ...patch, minTier: patch.minTier as Tier | undefined }, actor.id);
    if (!row) throw packError(404, 'PACK_CATEGORY_UNKNOWN', 'That category does not exist.');
    this.invalidate();
    await this.record(actor, null, 'pack.category.edited', 'PackCategory', categoryKey, { fields: Object.keys(patch) });
    return row;
  }
  async adminAddons(): Promise<StoredAddon[]> { return (await this.reference()).addons; }

  async adminSettings(): Promise<{ gatedPacksOpen: boolean; onlineMedicineCheckout: boolean }> { const r = await this.reference(); return { gatedPacksOpen: r.gatedPacksOpen, onlineMedicineCheckout: r.onlineMedicineCheckout }; }
  async setSetting(name: keyof typeof PACK_SETTING_KEYS, value: boolean, actor: PackActor): Promise<void> {
    await this.refs.setSettingBool(PACK_SETTING_KEYS[name], value);
    this.invalidate();
    await this.record(actor, null, 'pack.setting.changed', 'PackSetting', name, { name, value });
  }

  /** SUPER_ADMIN only while add-on prices are PENDING: staff switch an add-on pack on or off for one vendor. Ending it hides what it gave and keeps every record. */
  async setVendorAddon(vendorId: string, addonKey: string, status: 'ACTIVE' | 'ENDED', actor: PackActor): Promise<{ addonKey: string; status: string }> {
    return this.queue.run(`pack:${vendorId}`, async () => {
      const r = await this.reference();
      const addon = r.addons.find((a) => a.key === addonKey);
      if (!addon) throw packError(404, 'PACK_NOT_FOUND', 'That add-on pack does not exist.');
      const row = await this.vendors.setVendorAddon(vendorId, addonKey, status, { type: actor.type, id: actor.id });
      if (status === 'ACTIVE') for (const k of addon.grantsCapabilities) await this.vendors.setVendorCapability(vendorId, k, true, `ADDON:${addonKey}`);
      await this.record(actor, vendorId, status === 'ACTIVE' ? 'pack.addon.on' : 'pack.addon.off', 'VendorPackAddon', addonKey, { addonKey, status });
      return { addonKey: row.addonKey, status: row.status };
    });
  }
}
