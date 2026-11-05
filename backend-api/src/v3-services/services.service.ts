import { BadRequestException, ConflictException, Injectable, Optional } from '@nestjs/common';
import { ActivityBus } from '../common/activity-bus';
import { EntitlementsService } from '../plans/entitlements/entitlements.service';
import { Actor } from '../plans/admin/audit.service';
import { computeTax, TaxOutcome } from '../v3-wallet/core/tax-core';
import { WalletRuleError } from '../v3-wallet/core/wallet-core';
import { postEntry } from '../v3-wallet/wallet-engine';
import { WalletSettingsService } from '../v3-wallet/settings/wallet-settings.service';
import { notActive, walletError, walletHttpError } from '../v3-wallet/wallet.errors';
import { V3WalletService } from '../v3-wallet/wallet.service';
import { WalletStore } from '../v3-wallet/wallet.store';
import {
  approvalProblem, fundingChoice, packRemainingFor, planStateAllows, PlanSnapshot, resolvePrice, trackAllows, validatePackItems, validateServiceInput, ServiceInput,
} from './core/services-core';
import { conflict, packNotFound, priceNotFound, serviceNotFound, servicesError } from './services.errors';
import { DuplicateError, PackRow, PriceRow, PurchaseRow, ServiceRow, ServicesStore, ServicesTx, ServiceUsagePort } from './services.store';

const MAX_PAISE = 100_000_000;
const priceView = (p: PriceRow) => ({ id: p.id, amountPaise: p.amountPaise, currency: p.currency, taxCategory: p.taxCategory, taxInclusive: p.taxInclusive, effectiveFrom: p.effectiveFrom, status: p.status, note: p.note, approvedBy: p.approvedBy, approvedAt: p.approvedAt, createdAt: p.createdAt });
const publicPrice = (p: PriceRow) => ({ amountPaise: p.amountPaise, currency: p.currency, taxInclusive: p.taxInclusive, effectiveFrom: p.effectiveFrom });
const serviceView = (s: ServiceRow) => ({ key: s.key, name: s.name, shortDescription: s.shortDescription, includesText: s.includesText, approvalText: s.approvalText, kind: s.kind, doneBy: s.doneBy, deliveryKind: s.deliveryKind, planStateRule: s.planStateRule, trackScope: s.trackScope, publicVisible: s.publicVisible, sortOrder: s.sortOrder, status: s.status });
const packView = (p: PackRow) => ({ key: p.key, name: p.name, description: p.description, items: p.items, validityDays: p.validityDays, status: p.status });
const taxView = (t: TaxOutcome) => (t.ok ? { ok: true as const, intraState: t.intraState, taxInclusive: t.taxInclusive, taxableMinor: t.taxableMinor, taxMinor: t.taxMinor, totalMinor: t.totalMinor, lines: t.lines } : { ok: false as const, problem: t.problem });

/**
 * The service catalogue, the price book and the add-on packs (slice 5.16b). Everything our team does for a vendor is a paid SERVICE (owner rule 1): the vendor sees what it includes, who does it,
 * how approval works and the price BEFORE confirming. No price is invented: a price exists only after staff proposed it and a SUPER_ADMIN approved it with an effective date; a service without
 * one says "price not set". The funding order is allowance, then pack, then wallet. Money moves only through the wallet engine (postEntry) inside a unit of work shared with the rows it pays for.
 * Settings and reads happen BEFORE a unit opens, never inside one.
 */
@Injectable()
export class ServicesCatalogService {
  clock: () => Date = () => new Date();
  constructor(
    private readonly store: ServicesStore, private readonly walletStore: WalletStore, private readonly wallet: V3WalletService, private readonly walletSettings: WalletSettingsService,
    private readonly entitlements: EntitlementsService, private readonly usage: ServiceUsagePort, @Optional() private readonly bus?: ActivityBus,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────────────────── public
  /** The marketing pages' catalogue: visible, active services that have an APPROVED price in force. Nothing internal, no proposals, no vendor data. */
  async publicCatalogue() {
    const now = this.clock(); const [services, prices] = await Promise.all([this.store.services(), this.store.allServicePrices()]);
    const items = services.filter((s) => s.status === 'ACTIVE' && s.publicVisible).flatMap((s) => {
      const p = resolvePrice(prices.filter((x) => x.ownerId === s.id), now);
      return p ? [{ key: s.key, name: s.name, shortDescription: s.shortDescription, includesText: s.includesText, approvalText: s.approvalText, doneBy: s.doneBy, deliveryKind: s.deliveryKind, price: publicPrice(p) }] : [];
    });
    return { items };
  }

  // ───────────────────────────────────────────────────────────────────────────────────────── the tax context
  private async taxContext(vendorId: string) {
    const [w, s, rates] = await Promise.all([this.walletStore.wallet(vendorId), this.walletSettings.get(), this.store.taxRates()]);
    return { wallet: w, sellerStateCode: s.walletSellerStateCode, buyerStateCode: w?.billingStateCode ?? null, rates };
  }
  private quote(p: PriceRow | null, ctx: Awaited<ReturnType<ServicesCatalogService['taxContext']>>, now: Date): TaxOutcome | null {
    return p ? computeTax({ amountMinor: p.amountPaise, taxInclusive: p.taxInclusive, buyerStateCode: ctx.buyerStateCode, sellerStateCode: ctx.sellerStateCode, rates: ctx.rates, now, category: p.taxCategory }) : null;
  }

  // ───────────────────────────────────────────────────────────────────────────────────────── vendor
  private async planSnapshot(vendorId: string): Promise<{ snap: PlanSnapshot; track: string | null; features: Record<string, { state: string; limit: number | null }> }> {
    const r = await this.entitlements.resolve(vendorId);
    return { snap: { level: (r.level as PlanSnapshot['level']) ?? null, subscriptionStatus: r.subscriptionStatus, suspended: r.suspended }, track: r.track, features: r.features };
  }

  /** Every service the vendor could ask for, with price and tax, what the plan includes, what a pack still holds, whether it can be bought now, and how it would be paid. */
  async vendorServices(vendorId: string) {
    await this.wallet.syncActivation(vendorId);
    const now = this.clock();
    const [services, prices, purchases, ctx, plan] = await Promise.all([this.store.services(), this.store.allServicePrices(), this.store.purchasesFor(vendorId), this.taxContext(vendorId), this.planSnapshot(vendorId)]);
    const purchaseLite = purchases.map((p) => ({ id: p.id, remaining: p.remaining, purchasedAt: p.purchasedAt, expiresAt: p.expiresAt }));
    const items = [];
    for (const s of services.filter((x) => x.status === 'ACTIVE')) {
      const price = resolvePrice(prices.filter((x) => x.ownerId === s.id), now);
      const tax = this.quote(price, ctx, now);
      const feat = plan.features[`services.included.${s.key}`];
      const allowance = feat && feat.state === 'LIMITED' && feat.limit !== null ? { limit: feat.limit, used: await this.usage.allowanceUsed(vendorId, s.key) } : null;
      const packCount = packRemainingFor(purchaseLite, s.key, now);
      const planOk = planStateAllows(s.planStateRule, plan.snap); const trackOk = trackAllows(s.trackScope, plan.track);
      const funding = fundingChoice({ allowance, packCount, totalMinor: tax && tax.ok ? tax.totalMinor : null, taxProblem: tax && !tax.ok ? tax.problem : null, wallet: ctx.wallet ? { status: ctx.wallet.status, availablePaise: ctx.wallet.balancePaise - ctx.wallet.heldPaise } : null });
      items.push({
        ...serviceView(s), publicVisible: undefined, status: undefined, sortOrder: undefined, trackScope: undefined,
        price: price ? publicPrice(price) : null, priceNote: price ? null : 'Price not set', tax: tax ? taxView(tax) : null,
        allowance: allowance ? { limit: allowance.limit, used: allowance.used, remaining: Math.max(0, allowance.limit - allowance.used) } : null, pack: { remaining: packCount },
        available: planOk && trackOk, unavailableReason: !trackOk ? 'TRACK' : !planOk ? 'PLAN_STATE' : null,
        funding: planOk && trackOk ? funding : { kind: 'NONE', reason: !trackOk ? 'TRACK' : 'PLAN_STATE' },
      });
    }
    return { items, wallet: ctx.wallet ? { status: ctx.wallet.status, availablePaise: ctx.wallet.balancePaise - ctx.wallet.heldPaise } : { status: 'INACTIVE', availablePaise: 0 } };
  }

  async vendorPacks(vendorId: string) {
    const now = this.clock();
    const [packs, prices, services, purchases, ctx] = await Promise.all([this.store.packs(), this.store.allPackPrices(), this.store.services(), this.store.purchasesFor(vendorId), this.taxContext(vendorId)]);
    const names = new Map(services.map((s) => [s.key, s.name]));
    return {
      items: packs.filter((p) => p.status === 'ACTIVE').map((p) => {
        const price = resolvePrice(prices.filter((x) => x.ownerId === p.id), now); const tax = this.quote(price, ctx, now);
        return { ...packView(p), status: undefined, items: p.items.map((i) => ({ ...i, name: names.get(i.serviceKey) ?? i.serviceKey })), price: price ? publicPrice(price) : null, priceNote: price ? null : 'Price not set', tax: tax ? taxView(tax) : null };
      }),
      purchases: purchases.map((u) => ({ id: u.id, packKey: packs.find((p) => p.id === u.packId)?.key ?? null, remaining: u.remaining, purchasedAt: u.purchasedAt, expiresAt: u.expiresAt, paidPaise: u.priceSnapshotPaise })),
    };
  }

  /**
   * Buy a pack with wallet credit. One unit of work: the PACK_PURCHASE ledger entry and the purchase row commit together. Idempotent by key (the same key returns the first purchase). Every service in
   * the pack must be one the vendor could buy now (its plan-state rule and track); the price must be approved and in force; the tax must be workable.
   */
  async purchasePack(vendorId: string, packKey: string, idempotencyKey: string, actor: Actor) {
    const key = String(idempotencyKey ?? '');
    const w = await this.wallet.syncActivation(vendorId);
    if (!w || w.status === 'INACTIVE') throw notActive();
    const now = this.clock();
    const [pack, ctx, plan, services, ws] = await Promise.all([this.store.packByKey(String(packKey).slice(0, 60)), this.taxContext(vendorId), this.planSnapshot(vendorId), this.store.services(), this.walletSettings.get()]);
    if (!pack || pack.status !== 'ACTIVE') throw conflict('PACK_NOT_PURCHASABLE', 'That pack cannot be bought.');
    const price = resolvePrice(await this.store.packPrices(pack.id), now);
    if (!price) throw conflict('SERVICE_PRICE_NOT_SET', 'That pack has no approved price right now.');
    const tax = this.quote(price, ctx, now)!;
    if (!tax.ok) throw new ConflictException(walletError('TAX_NOT_CONFIGURED', 'Tax is not set up yet, so this cannot be priced.', { problem: tax.problem }));
    for (const item of pack.items) {
      const svc = services.find((x) => x.key === item.serviceKey);
      if (!svc || svc.status === 'RETIRED') throw conflict('PACK_NOT_PURCHASABLE', 'That pack includes a service that is no longer offered.');
      if (!trackAllows(svc.trackScope, plan.track)) throw conflict('SERVICE_TRACK', `${svc.name} is not offered for your kind of business.`);
      if (!planStateAllows(svc.planStateRule, plan.snap)) throw conflict('SERVICE_PLAN_STATE', `${svc.name} can be bought only while your Pro plan is active.`);
    }
    const limits = { minPaise: ws.walletTopupMinPaise, maxPaise: ws.walletTopupMaxPaise };
    let result: { purchase: PurchaseRow; replay: boolean };
    try {
      result = await this.store.withWallet(vendorId, async (stx, wtx) => {
        const prior = await stx.purchaseByKey(vendorId, key);
        if (prior) { if (prior.packId !== pack.id) throw new ConflictException(walletError('WALLET_IDEMPOTENCY_CONFLICT', 'That request key was already used for a different pack.')); return { purchase: prior, replay: true }; }
        const post = await postEntry(wtx, { kind: 'PACK_PURCHASE', amountPaise: tax.totalMinor, idempotencyKey: `pack:${key}`, refType: 'pack', refId: pack.id, actor: { type: actor.type, id: actor.id }, now });
        const purchase = await stx.insertPurchase({
          vendorId, packId: pack.id, idempotencyKey: key, remaining: Object.fromEntries(pack.items.map((i) => [i.serviceKey, i.count])), priceSnapshotPaise: tax.totalMinor,
          taxSnapshot: { priceId: price.id, basePaise: price.amountPaise, taxInclusive: price.taxInclusive, taxMinor: tax.taxMinor, taxableMinor: tax.taxableMinor, lines: tax.lines, intraState: tax.intraState },
          purchasedAt: now, expiresAt: pack.validityDays ? new Date(now.getTime() + pack.validityDays * 86_400_000) : null, ledgerEntryId: post.entry.id,
        });
        await stx.audit(actor, 'pack.purchase', purchase.id, null, { packKey: pack.key, paidPaise: tax.totalMinor, ledgerId: post.entry.id });
        return { purchase, replay: false };
      });
    } catch (e) {
      if (e instanceof WalletRuleError) throw walletHttpError(e, limits);
      if (e instanceof DuplicateError) throw new ConflictException(walletError('WALLET_IDEMPOTENCY_CONFLICT', 'That request key was already used.'));
      throw e;
    }
    if (!result.replay) void this.bus?.emit({ type: 'pack.purchased', vendorId, at: now, actor: { type: actor.type, id: actor.id }, data: { packKey: pack.key, purchaseId: result.purchase.id, paidPaise: tax.totalMinor } });
    const u = result.purchase;
    return { id: u.id, packKey: pack.key, paidPaise: u.priceSnapshotPaise, remaining: u.remaining, purchasedAt: u.purchasedAt, expiresAt: u.expiresAt, replay: result.replay };
  }

  // ───────────────────────────────────────────────────────────────────────────────────────── staff: the catalogue
  /** `withPrices` is false for MARKETING: they read the catalogue but never see money fields. */
  async adminServices(withPrices: boolean) {
    const [services, prices] = await Promise.all([this.store.services(), withPrices ? this.store.allServicePrices() : Promise.resolve([] as PriceRow[])]);
    const now = this.clock();
    return { items: services.map((s) => ({ ...serviceView(s), ...(withPrices ? { priceInForce: (() => { const p = resolvePrice(prices.filter((x) => x.ownerId === s.id), now); return p ? priceView(p) : null; })(), proposedPrices: prices.filter((x) => x.ownerId === s.id && x.status === 'PROPOSED').map(priceView) } : {}) })) };
  }
  async adminService(key: string, withPrices: boolean) {
    const s = await this.store.serviceByKey(String(key).slice(0, 60)); if (!s) throw serviceNotFound();
    const prices = withPrices ? await this.store.servicePrices(s.id) : [];
    return { ...serviceView(s), ...(withPrices ? { prices: prices.map(priceView), priceInForce: (() => { const p = resolvePrice(prices, this.clock()); return p ? priceView(p) : null; })() } : {}) };
  }

  async createService(input: ServiceInput & { status?: string }, actor: Actor) {
    const problems = validateServiceInput(input); if (problems.length) throw new BadRequestException(servicesError('SERVICE_INVALID', problems[0], { errors: problems }));
    const status = input.status === 'ACTIVE' || input.status === 'RETIRED' ? input.status : 'DRAFT';
    try {
      return serviceView(await this.store.unit(async (tx) => {
        const row = await tx.insertService({
          key: input.key!, name: input.name!.trim(), shortDescription: input.shortDescription!.trim(), includesText: input.includesText!.trim(), approvalText: input.approvalText!.trim(), kind: input.kind ?? 'GENERAL',
          doneBy: (input.doneBy ?? 'TEAM') as ServiceRow['doneBy'], deliveryKind: (input.deliveryKind ?? 'TEAM_REQUEST') as ServiceRow['deliveryKind'], planStateRule: (input.planStateRule ?? 'PRO_ACTIVE_OR_GRACE') as ServiceRow['planStateRule'],
          trackScope: input.trackScope ?? [], publicVisible: input.publicVisible ?? false, sortOrder: input.sortOrder ?? 0, status,
        });
        await tx.audit(actor, 'service.create', row.id, null, { key: row.key, status });
        return row;
      }));
    } catch (e) { if (e instanceof DuplicateError) throw conflict('SERVICE_KEY_TAKEN', 'A service with that key already exists.'); throw e; }
  }

  async updateService(key: string, patch: ServiceInput & { status?: string }, actor: Actor) {
    const problems = validateServiceInput(patch, { partial: true }); if (patch.status !== undefined && !['DRAFT', 'ACTIVE', 'RETIRED'].includes(patch.status)) problems.push('The status must be DRAFT, ACTIVE or RETIRED.');
    if (problems.length) throw new BadRequestException(servicesError('SERVICE_INVALID', problems[0], { errors: problems }));
    return serviceView(await this.store.unit(async (tx) => {
      const cur = await tx.serviceByKey(String(key).slice(0, 60)); if (!cur) throw serviceNotFound();
      const next = await tx.updateService(cur.id, {
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}), ...(patch.shortDescription !== undefined ? { shortDescription: patch.shortDescription.trim() } : {}), ...(patch.includesText !== undefined ? { includesText: patch.includesText.trim() } : {}),
        ...(patch.approvalText !== undefined ? { approvalText: patch.approvalText.trim() } : {}), ...(patch.kind !== undefined ? { kind: patch.kind } : {}), ...(patch.doneBy !== undefined ? { doneBy: patch.doneBy as ServiceRow['doneBy'] } : {}),
        ...(patch.deliveryKind !== undefined ? { deliveryKind: patch.deliveryKind as ServiceRow['deliveryKind'] } : {}), ...(patch.planStateRule !== undefined ? { planStateRule: patch.planStateRule as ServiceRow['planStateRule'] } : {}),
        ...(patch.trackScope !== undefined ? { trackScope: patch.trackScope } : {}), ...(patch.publicVisible !== undefined ? { publicVisible: patch.publicVisible } : {}), ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
        ...(patch.status !== undefined ? { status: patch.status as ServiceRow['status'] } : {}),
      });
      await tx.audit(actor, 'service.update', cur.id, serviceView(cur), serviceView(next));
      return next;
    }));
  }

  // ───────────────────────────────────────────────────────────────────────────────────────── staff: the price book (services and packs share the rules)
  private priceSide(kind: 'service' | 'pack') {
    return kind === 'service'
      ? { list: (tx: ServicesTx, id: string) => tx.servicePrices(id), get: (tx: ServicesTx, id: string) => tx.getServicePrice(id), insert: (tx: ServicesTx, d: Parameters<ServicesTx['insertServicePrice']>[0]) => tx.insertServicePrice(d), update: (tx: ServicesTx, id: string, e: PriceRow['status'][], p: Parameters<ServicesTx['updateServicePrice']>[2]) => tx.updateServicePrice(id, e, p), owner: async (tx: ServicesTx, key: string) => tx.serviceByKey(String(key).slice(0, 60)), notFound: serviceNotFound }
      : { list: (tx: ServicesTx, id: string) => tx.packPrices(id), get: (tx: ServicesTx, id: string) => tx.getPackPrice(id), insert: (tx: ServicesTx, d: Parameters<ServicesTx['insertPackPrice']>[0]) => tx.insertPackPrice(d), update: (tx: ServicesTx, id: string, e: PriceRow['status'][], p: Parameters<ServicesTx['updatePackPrice']>[2]) => tx.updatePackPrice(id, e, p), owner: async (tx: ServicesTx, key: string) => tx.packByKey(String(key).slice(0, 60)), notFound: packNotFound };
  }
  private checkPriceInput(i: { amountPaise?: unknown; taxCategory?: unknown; taxInclusive?: unknown; note?: unknown; effectiveFrom?: unknown }, partial: boolean): string[] {
    const out: string[] = [];
    if (!partial || i.amountPaise !== undefined) if (!(typeof i.amountPaise === 'number' && Number.isInteger(i.amountPaise) && i.amountPaise > 0 && i.amountPaise <= MAX_PAISE)) out.push(`The price must be a whole number of paise from 1 to ${MAX_PAISE}.`);
    if (i.taxCategory !== undefined && !(typeof i.taxCategory === 'string' && /^[A-Z][A-Z0-9_]{1,30}$/.test(i.taxCategory))) out.push('The tax category must be capital letters, digits or underscores (ALL by default).');
    if (i.taxInclusive !== undefined && typeof i.taxInclusive !== 'boolean') out.push('Say whether the price includes tax (true or false).');
    if (i.note !== undefined && i.note !== null && !(typeof i.note === 'string' && i.note.length <= 300)) out.push('The note can be up to 300 characters.');
    return out;
  }

  async proposePrice(kind: 'service' | 'pack', key: string, input: { amountPaise: number; taxCategory?: string; taxInclusive?: boolean; note?: string }, actor: Actor) {
    const problems = this.checkPriceInput(input, false); if (problems.length) throw new BadRequestException(servicesError('SERVICE_PRICE_INVALID', problems[0], { errors: problems }));
    const side = this.priceSide(kind);
    return priceView(await this.store.unit(async (tx) => {
      const owner = await side.owner(tx, key); if (!owner) throw side.notFound();
      const row = await side.insert(tx, { ownerId: owner.id, amountPaise: input.amountPaise, currency: 'INR', taxCategory: input.taxCategory ?? 'ALL', taxInclusive: input.taxInclusive ?? false, effectiveFrom: null, note: input.note ?? null, createdBy: actor.id });
      await tx.audit(actor, `${kind}.price.propose`, row.id, null, { key, amountPaise: row.amountPaise });
      return row;
    }));
  }

  async editProposedPrice(kind: 'service' | 'pack', id: string, patch: { amountPaise?: number; taxCategory?: string; taxInclusive?: boolean; note?: string }, actor: Actor) {
    const problems = this.checkPriceInput(patch, true); if (problems.length) throw new BadRequestException(servicesError('SERVICE_PRICE_INVALID', problems[0], { errors: problems }));
    const side = this.priceSide(kind);
    return priceView(await this.store.unit(async (tx) => {
      const cur = await side.get(tx, String(id).slice(0, 64)); if (!cur) throw priceNotFound();
      if (cur.status !== 'PROPOSED') throw conflict('SERVICE_PRICE_STATE', 'Only a proposed price can be changed. Propose a new price instead.');
      const ok = await side.update(tx, cur.id, ['PROPOSED'], { ...(patch.amountPaise !== undefined ? { amountPaise: patch.amountPaise } : {}), ...(patch.taxCategory !== undefined ? { taxCategory: patch.taxCategory } : {}), ...(patch.taxInclusive !== undefined ? { taxInclusive: patch.taxInclusive } : {}), ...(patch.note !== undefined ? { note: patch.note } : {}) });
      if (!ok) throw conflict('SERVICE_PRICE_STATE', 'That price changed; reload it.');
      await tx.audit(actor, `${kind}.price.edit`, cur.id, priceView(cur), patch);
      return (await side.get(tx, cur.id))!;
    }));
  }

  /** SUPER_ADMIN only (the role matrix). An effective date is required; the rules are in approvalProblem. Approving never changes the amount: what was proposed is what is approved. */
  async approvePrice(kind: 'service' | 'pack', id: string, input: { effectiveFrom: string }, actor: Actor) {
    const when = typeof input.effectiveFrom === 'string' ? new Date(input.effectiveFrom) : null;
    const side = this.priceSide(kind); const now = this.clock();
    try {
      return priceView(await this.store.unit(async (tx) => {
        const cur = await side.get(tx, String(id).slice(0, 64)); if (!cur) throw priceNotFound();
        const problem = approvalProblem(await side.list(tx, cur.ownerId), cur.id, when, now);
        if (problem) throw conflict('SERVICE_PRICE_STATE', problem === 'EFFECTIVE_DATE_REQUIRED' ? 'An effective date is required to approve a price.' : problem === 'EFFECTIVE_DATE_IN_PAST' ? 'The price cannot start in the past.' : problem === 'EFFECTIVE_DATE_NOT_LATER' ? 'The price must start after the price now in force.' : problem === 'EFFECTIVE_DATE_TAKEN' ? 'Another price of this item already starts at that moment.' : 'Only a proposed price can be approved.', { problem });
        const ok = await side.update(tx, cur.id, ['PROPOSED'], { status: 'APPROVED', effectiveFrom: when, approvedBy: actor.id, approvedAt: now });
        if (!ok) throw conflict('SERVICE_PRICE_STATE', 'That price changed; reload it.');
        await tx.audit(actor, `${kind}.price.approve`, cur.id, { status: 'PROPOSED', amountPaise: cur.amountPaise }, { status: 'APPROVED', amountPaise: cur.amountPaise, effectiveFrom: when });
        return (await side.get(tx, cur.id))!;
      }));
    } catch (e) { if (e instanceof DuplicateError) throw conflict('SERVICE_PRICE_STATE', 'Another price of this item already starts at that moment.'); throw e; }
  }

  async retirePrice(kind: 'service' | 'pack', id: string, actor: Actor) {
    const side = this.priceSide(kind);
    return priceView(await this.store.unit(async (tx) => {
      const cur = await side.get(tx, String(id).slice(0, 64)); if (!cur) throw priceNotFound();
      if (cur.status === 'RETIRED') return cur;
      const ok = await side.update(tx, cur.id, ['PROPOSED', 'APPROVED'], { status: 'RETIRED' });
      if (!ok) throw conflict('SERVICE_PRICE_STATE', 'That price changed; reload it.');
      await tx.audit(actor, `${kind}.price.retire`, cur.id, { status: cur.status }, { status: 'RETIRED' });
      return (await side.get(tx, cur.id))!;
    }));
  }

  // ───────────────────────────────────────────────────────────────────────────────────────── staff: packs
  async adminPacks(withPrices: boolean) {
    const [packs, prices] = await Promise.all([this.store.packs(), withPrices ? this.store.allPackPrices() : Promise.resolve([] as PriceRow[])]); const now = this.clock();
    return { items: packs.map((p) => ({ ...packView(p), ...(withPrices ? { priceInForce: (() => { const x = resolvePrice(prices.filter((y) => y.ownerId === p.id), now); return x ? priceView(x) : null; })(), proposedPrices: prices.filter((y) => y.ownerId === p.id && y.status === 'PROPOSED').map(priceView) } : {}) })) };
  }
  async adminPack(key: string, withPrices: boolean) {
    const p = await this.store.packByKey(String(key).slice(0, 60)); if (!p) throw packNotFound();
    return { ...packView(p), ...(withPrices ? { prices: (await this.store.packPrices(p.id)).map(priceView) } : {}) };
  }
  private async packProblems(i: { key?: string; name?: string; description?: string; items?: unknown; validityDays?: unknown; status?: string }, partial: boolean): Promise<string[]> {
    const out: string[] = [];
    if (!partial && !(typeof i.key === 'string' && /^[A-Z][A-Z0-9_]{2,40}$/.test(i.key))) out.push('The key must be 3 to 41 capital letters, digits or underscores, starting with a letter.');
    if (partial && i.key !== undefined) out.push('The key cannot be changed.');
    if ((!partial || i.name !== undefined) && !(typeof i.name === 'string' && i.name.trim().length >= 2 && i.name.length <= 80 && !/[<>]/.test(i.name))) out.push('The name must be 2 to 80 plain characters.');
    if ((!partial || i.description !== undefined) && !(typeof i.description === 'string' && i.description.trim().length >= 5 && i.description.length <= 600 && !/[<>]/.test(i.description))) out.push('The description must be 5 to 600 plain characters.');
    if (!partial || i.items !== undefined) { const known = new Set((await this.store.services()).map((s) => s.key)); const p = validatePackItems(i.items, known); if (p) out.push(p); }
    if (i.validityDays !== undefined && i.validityDays !== null && !(typeof i.validityDays === 'number' && Number.isInteger(i.validityDays) && i.validityDays >= 1 && i.validityDays <= 3650)) out.push('The validity must be a whole number of days (or empty for a pack that does not expire).');
    if (i.status !== undefined && !['DRAFT', 'ACTIVE', 'RETIRED'].includes(i.status)) out.push('The status must be DRAFT, ACTIVE or RETIRED.');
    return out;
  }
  async createPack(input: { key: string; name: string; description: string; items: PackRow['items']; validityDays?: number | null; status?: string }, actor: Actor) {
    const problems = await this.packProblems(input, false); if (problems.length) throw new BadRequestException(servicesError('PACK_INVALID', problems[0], { errors: problems }));
    try {
      return packView(await this.store.unit(async (tx) => {
        const row = await tx.insertPack({ key: input.key, name: input.name.trim(), description: input.description.trim(), items: input.items, validityDays: input.validityDays ?? null, status: (input.status as PackRow['status']) ?? 'DRAFT' });
        await tx.audit(actor, 'pack.create', row.id, null, { key: row.key });
        return row;
      }));
    } catch (e) { if (e instanceof DuplicateError) throw conflict('PACK_KEY_TAKEN', 'A pack with that key already exists.'); throw e; }
  }
  async updatePack(key: string, patch: { name?: string; description?: string; items?: PackRow['items']; validityDays?: number | null; status?: string }, actor: Actor) {
    const problems = await this.packProblems(patch, true); if (problems.length) throw new BadRequestException(servicesError('PACK_INVALID', problems[0], { errors: problems }));
    return packView(await this.store.unit(async (tx) => {
      const cur = await tx.packByKey(String(key).slice(0, 60)); if (!cur) throw packNotFound();
      const next = await tx.updatePack(cur.id, { ...(patch.name !== undefined ? { name: patch.name.trim() } : {}), ...(patch.description !== undefined ? { description: patch.description.trim() } : {}), ...(patch.items !== undefined ? { items: patch.items } : {}), ...(patch.validityDays !== undefined ? { validityDays: patch.validityDays } : {}), ...(patch.status !== undefined ? { status: patch.status as PackRow['status'] } : {}) });
      await tx.audit(actor, 'pack.update', cur.id, packView(cur), packView(next));
      return next;
    }));
  }
}
