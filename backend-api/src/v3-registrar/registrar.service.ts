import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { ActivityBus } from '../common/activity-bus';
import { KeyedQueue } from '../common/keyed-queue';
import { EntitlementsService } from '../plans/entitlements/entitlements.service';
import { Actor } from '../plans/admin/audit.service';
import { planError } from '../plans/plans.errors';
import { financialYearOf, formatInvoiceNumber } from '../plan-billing/core/amounts';
import { DomainConnectionService } from '../v3-domain-automation/connection.service';
import { computeTax } from '../v3-wallet/core/tax-core';
import { WalletRuleError } from '../v3-wallet/core/wallet-core';
import { WalletSettingsService } from '../v3-wallet/settings/wallet-settings.service';
import { postEntry } from '../v3-wallet/wallet-engine';
import { notActive, walletError, walletHttpError } from '../v3-wallet/wallet.errors';
import { V3WalletService } from '../v3-wallet/wallet.service';
import { WalletStore } from '../v3-wallet/wallet.store';
import { expiryAlertDue, Margin, marginFor, nextOrder, OrderStatus, parseDomain, priceFromCost, renewalAllowed, resolveMargin } from './core/registrar-core';
import { RegistrantDetails, RegistrarError, RegistrarPort } from './registrar.port';
import { DuplicateOrderError, MarginDbRow, OrderKind, OrderRow, RegisteredRow, RegistrarStore } from './registrar.store';
import { RegistrarSettings, RegistrarSettingsService } from './settings/registrar-settings';

export const REGISTRAR_ERROR_CODES = [
  'REGISTRAR_NOT_LIVE', 'REGISTRAR_UNAVAILABLE', 'REGISTRAR_NOT_CONFIGURED', 'REGISTRAR_BALANCE_LOW', 'DOMAIN_INVALID', 'DOMAIN_NOT_AVAILABLE', 'DOMAIN_NOT_FOUND', 'DOMAIN_EXPIRED', 'DOMAIN_PRICE_NOT_SET',
  'DOMAIN_PRICE_UNAVAILABLE', 'DOMAIN_PRICE_CHANGED', 'DOMAIN_ORDER_NOT_FOUND', 'DOMAIN_ORDER_UNSETTLED', 'IDENTITY_NOT_APPROVED', 'DOMAIN_CONSENT_REQUIRED', 'MARGIN_INVALID', 'MARGIN_NOT_FOUND', 'MARGIN_STATE_INVALID',
] as const;
type RegistrarCode = (typeof REGISTRAR_ERROR_CODES)[number];
const err = (code: RegistrarCode, message: string, extra: Record<string, unknown> = {}): { message: string; code: RegistrarCode } & Record<string, unknown> => ({ message, code, ...extra });

const SYSTEM: Actor = { type: 'SYSTEM', id: null, ip: null };
const KEY = /^[A-Za-z0-9_:-]{8,80}$/;
/** The longest registration a registry accepts (a technical fact of the registries, not a business value). */
const MAX_YEARS = 10;
/** The one in-process queue a purchase waits in BEFORE any transaction opens. It is NOT the wallet queue: the wallet unit takes that one itself and the queue is not reentrant (found on staging for the theme switch). */
export const registrarQueue = new KeyedQueue();
export const registrarKey = (vendorId: string): string => `registrar:${vendorId}`;

export interface Quote {
  domain: string; tld: string; years: number; kind: OrderKind; costPaise: number; marginPaise: number; privacyPaise: number; taxablePaise: number; taxPaise: number; totalPaise: number; lines: Array<{ name: string; ratePercent: number; amountPaise: number }>;
  taxSnapshot: Record<string, unknown>;
}
export interface PurchaseInput { domain: string; years: number; privacy?: boolean; idempotencyKey: string; expectedTotalPaise: number; consent?: boolean }
export interface RenewInput { years: number; idempotencyKey: string; expectedTotalPaise: number }
export interface PurchaseBy { type: 'VENDOR' | 'STAFF'; actor: Actor; reason?: string }

const orderView = (o: OrderRow) => ({
  id: o.id, kind: o.kind, domain: o.domain, years: o.years, status: o.status, amountPaise: o.amountPaise, privacy: o.privacy, failureCode: o.failureCode, createdAt: o.createdAt, updatedAt: o.updatedAt,
  settled: o.status === 'COMPLETED' || o.status === 'FAILED', pendingConfirmation: o.status === 'UNKNOWN' || o.status === 'SUBMITTED',
});
const registeredView = (r: RegisteredRow) => ({ id: r.id, domain: r.domain, status: r.status, expiresAt: r.expiresAt, privacy: r.privacy, dnsStatus: r.dnsStatus, registeredAt: r.registeredAt, lastRenewedAt: r.lastRenewedAt });
const addYears = (d: Date, y: number): Date => { const x = new Date(d.getTime()); x.setUTCFullYear(x.getUTCFullYear() + y); return x; };

/**
 * Domain sales (slice 5.6d). Search and price lists are real read-only registrar calls behind REGISTRAR_LIVE_SEARCH; buying is behind REGISTRAR_LIVE_PURCHASE (both default OFF, see GatedRegistrarPort).
 * Pro only (owner answer Q2). The sale price is the registrar cost plus an approved, effective-dated margin from the price book; GST is added from the tax table and the wallet holds and charges exactly
 * that total, with no rounding (Q8).
 *
 * A purchase is a saga serialised per vendor in memory BEFORE any transaction: (1) one unit writes the order and the wallet HOLD together; (2) the vendor is made a registrar customer and contact once;
 * (3) the order is marked SUBMITTED, THEN the registrar is called outside any transaction; (4) a definite refusal releases the hold (a reversal of a failed purchase, not a refund); an unsure answer (a timeout)
 * leaves the hold and the order UNKNOWN for recovery and reconciliation; a success charges the hold, records the domain, issues the invoice and brings the name into the vendor's domains, all in one unit.
 * The unique (vendorId, idempotencyKey) and the unique live name stop a domain being bought or charged twice.
 */
@Injectable()
export class RegistrarService {
  private readonly logger = new Logger(RegistrarService.name);
  clock: () => Date = () => new Date();

  constructor(
    private readonly store: RegistrarStore, private readonly port: RegistrarPort, private readonly settings: RegistrarSettingsService, private readonly wallet: V3WalletService, private readonly walletStore: WalletStore,
    private readonly walletSettings: WalletSettingsService, private readonly ents: EntitlementsService, @Optional() private readonly conn?: DomainConnectionService, @Optional() private readonly bus?: ActivityBus,
  ) {}

  private emit(type: string, vendorId: string, actor: Actor, data: Record<string, unknown> = {}): void { void this.bus?.emit({ type, vendorId, at: this.clock(), actor: { type: actor.type, id: actor.id }, data }); }

  // ───────────────────────────────────────────────────────────────────────────── plan and errors
  private async proState(vendorId: string): Promise<{ allowed: boolean; upsellText: string | null }> {
    const r = await this.ents.resolve(vendorId);
    const f = r.features['site.custom_domain'];
    return { allowed: r.level === 'PRO' && r.subscriptionStatus === 'ACTIVE' && !r.suspended, upsellText: f?.upsellText ?? null };
  }
  private async needPro(vendorId: string): Promise<void> {
    const p = await this.proState(vendorId);
    if (!p.allowed) throw new ForbiddenException(planError('FEATURE_LOCKED', 'Buying and renewing a domain is part of the Pro plan.', { feature: 'site.domain_purchase', upsellText: p.upsellText }));
  }
  private http(e: unknown): Error {
    if (e instanceof RegistrarError) {
      if (e.code === 'REGISTRAR_LIVE_DISABLED') return new ServiceUnavailableException(err('REGISTRAR_NOT_LIVE', 'Domain search and buying are not switched on yet.'));
      if (e.code === 'REGISTRAR_BALANCE_LOW') return new ConflictException(err('REGISTRAR_BALANCE_LOW', 'Domain buying is paused for now. Please try again later.'));
      if (e.code === 'DOMAIN_NOT_AVAILABLE') return new ConflictException(err('DOMAIN_NOT_AVAILABLE', 'That domain is not available.'));
      return new ServiceUnavailableException(err('REGISTRAR_UNAVAILABLE', 'We could not reach the domain service just now. Please try again.'));
    }
    return e instanceof Error ? e : new Error('error');
  }

  // ───────────────────────────────────────────────────────────────────────────── what the vendor sees first
  /** Free vendors see the screen as a locked preview and nothing is asked of the registrar for them. */
  async overview(vendorId: string) {
    const [p, reg, s, rows] = await Promise.all([this.proState(vendorId), this.store.registrant(vendorId), this.settings.get(), this.store.margins()]);
    const now = this.clock();
    const tlds = [...new Set(rows.filter((r) => r.tld !== 'privacy').map((r) => r.tld))].filter((t) => resolveMargin(rows, t, now));
    return {
      state: p.allowed ? 'ACTIVE' : 'LOCKED_PREVIEW', upsellText: p.allowed ? null : p.upsellText, identity: reg?.status ?? 'INCOMPLETE',
      purchasesReady: s.registrarNameServers !== null && s.registrarMinBalancePaise !== null, extensions: p.allowed ? tlds : [],
    };
  }

  // ───────────────────────────────────────────────────────────────────────────── search and price
  async search(vendorId: string, nameIn: string) {
    await this.needPro(vendorId);
    const raw = String(nameIn ?? '').trim().toLowerCase();
    const sld = raw.includes('.') ? raw.slice(0, raw.indexOf('.')) : raw;
    if (!/^(?!-)[a-z0-9-]{1,63}(?<!-)$/.test(sld)) throw new BadRequestException(err('DOMAIN_INVALID', 'Use letters, digits and hyphens for the name.'));
    const now = this.clock(); const rows = await this.store.margins();
    const tlds = [...new Set(rows.filter((r) => r.tld !== 'privacy').map((r) => r.tld))].filter((t) => resolveMargin(rows, t, now));
    if (tlds.length === 0) return { name: sld, results: [] };
    try {
      const hits = await this.port.search(sld, tlds);
      const free = hits.filter((h) => h.status === 'AVAILABLE');
      const costs = free.length ? await this.port.costs(free.map((h) => parseDomain(h.domain)).filter((p): p is Extract<ReturnType<typeof parseDomain>, { ok: true }> => p.ok).map((p) => p.tld)) : {};
      const results = [];
      for (const h of hits) {
        const p = parseDomain(h.domain);
        if (!p.ok) continue;
        let price: { totalPaise: number } | null = null;
        if (h.status === 'AVAILABLE' && costs[p.tld]) { try { price = { totalPaise: (await this.priceOut(vendorId, p.domain, p.tld, 1, false, 'REGISTER', costs[p.tld].registerPaise, rows, now)).totalPaise }; } catch { price = null; } }
        results.push({ domain: h.domain, status: h.status, price });
      }
      return { name: sld, results };
    } catch (e) { throw this.http(e); }
  }

  private async priceOut(vendorId: string, domain: string, tld: string, years: number, privacy: boolean, kind: OrderKind, yearlyCostPaise: number, rows: readonly MarginDbRow[], now: Date): Promise<Quote> {
    const m = marginFor(rows, tld, now);
    if (!m) throw new ConflictException(err('DOMAIN_PRICE_NOT_SET', 'That extension has no approved price yet.'));
    const totalCost = yearlyCostPaise * years;
    const margin: Margin = m.kind === 'FIXED_PAISE' ? { kind: 'FIXED_PAISE', value: m.value * years } : m;
    const base = priceFromCost(totalCost, margin);
    let privacyPaise = 0;
    if (privacy) { const pm = marginFor(rows, 'privacy', now); if (!pm || pm.kind !== 'FIXED_PAISE') throw new ConflictException(err('DOMAIN_PRICE_NOT_SET', 'Privacy protection has no approved price yet.')); privacyPaise = pm.value * years; }
    const taxable = base.pricePaise + privacyPaise;
    const w = await this.walletStore.wallet(vendorId); const ws = await this.walletSettings.get();
    // GST is its own line on top of the price (owner answer Q1): the rate comes from the tax table, the state rule from the vendor's billing state against Get4Domain's own.
    const tax = computeTax({ amountMinor: taxable, taxInclusive: false, buyerStateCode: w?.billingStateCode ?? null, sellerStateCode: ws.walletSellerStateCode || null, rates: await this.walletStore.taxRates(), now, category: 'DOMAIN' });
    if (!tax.ok) throw new ConflictException(walletError('TAX_NOT_CONFIGURED', tax.problem === 'BUYER_STATE_MISSING' ? 'Add your state in your billing details first, so the GST can be worked out.' : 'Tax is not set up yet, so this cannot be priced.', { problem: tax.problem }));
    return {
      domain, tld, years, kind, costPaise: base.costPaise, marginPaise: base.marginPaise, privacyPaise, taxablePaise: tax.taxableMinor, taxPaise: tax.taxMinor, totalPaise: tax.totalMinor,
      lines: tax.lines.map((l) => ({ name: l.name, ratePercent: l.ratePercent, amountPaise: l.amountMinor })),
      taxSnapshot: { taxInclusive: false, taxableMinor: tax.taxableMinor, taxMinor: tax.taxMinor, totalMinor: tax.totalMinor, lines: tax.lines, intraState: tax.intraState, buyerStateCode: w?.billingStateCode ?? null, buyerGstin: w?.billingGstin ?? null, sellerStateCode: ws.walletSellerStateCode || null, years, costPaise: base.costPaise, marginPaise: base.marginPaise, privacyPaise },
    };
  }

  /** The exact price of one purchase or renewal, worked out fresh from the registrar's price list, the approved margin and the tax table. */
  async quote(vendorId: string, input: { domain: string; years: number; privacy?: boolean }, kind: OrderKind = 'REGISTER'): Promise<Quote> {
    await this.needPro(vendorId);
    const p = parseDomain(input.domain);
    if (!p.ok) throw new BadRequestException(err('DOMAIN_INVALID', 'That is not a domain name we can register. Use a name and an extension, for example mybusiness.in.'));
    const years = Number(input.years);
    if (!Number.isInteger(years) || years < 1 || years > MAX_YEARS) throw new BadRequestException(err('DOMAIN_INVALID', 'Choose a whole number of years.'));
    let costs; try { costs = await this.port.costs([p.tld]); } catch (e) { throw this.http(e); }
    const c = costs[p.tld];
    if (!c) throw new ConflictException(err('DOMAIN_PRICE_UNAVAILABLE', 'We cannot price that extension right now.'));
    return this.priceOut(vendorId, p.domain, p.tld, years, input.privacy === true, kind, kind === 'RENEW' ? c.renewPaise : c.registerPaise, await this.store.margins(), this.clock());
  }

  // ───────────────────────────────────────────────────────────────────────────── purchase
  async purchase(vendorId: string, input: PurchaseInput, by: PurchaseBy) {
    const key = String(input.idempotencyKey ?? '');
    if (!KEY.test(key)) throw new BadRequestException(err('DOMAIN_INVALID', 'The request key must be 8 to 80 letters, digits, dashes, colons or underscores.'));
    if (by.type === 'STAFF' && !(typeof by.reason === 'string' && by.reason.trim().length >= 5)) throw new BadRequestException(err('DOMAIN_INVALID', 'A reason of at least 5 characters is required to register a domain on behalf of a vendor.'));
    if (by.type === 'VENDOR' && input.consent !== true) throw new BadRequestException(err('DOMAIN_CONSENT_REQUIRED', 'Please confirm that you are the owner of this domain and that your registered details are correct.'));
    const p = parseDomain(input.domain);
    if (!p.ok) throw new BadRequestException(err('DOMAIN_INVALID', 'That is not a domain name we can register.'));
    const prior = await this.store.orderByKey(vendorId, key);
    if (prior) return this.replay(prior, p.domain, Number(input.years));
    await this.wallet.syncActivation(vendorId);
    await this.needPro(vendorId);
    const reg = await this.store.registrant(vendorId);
    if (!reg || reg.status !== 'APPROVED') throw new ConflictException(err('IDENTITY_NOT_APPROVED', 'Your identity check has to be approved before your first purchase.'));
    const s = await this.settings.get();
    if (s.registrarNameServers === null || s.registrarMinBalancePaise === null) throw new ConflictException(err('REGISTRAR_NOT_CONFIGURED', 'Domain buying is not set up yet.'));

    const out = await registrarQueue.run(registrarKey(vendorId), async () => {
      const again = await this.store.orderByKey(vendorId, key);
      if (again) return { row: again, replay: true };
      const w = await this.walletStore.wallet(vendorId);
      if (!w || w.status === 'INACTIVE') throw notActive();
      let hit;
      try { hit = (await this.port.search(p.sld, [p.tld])).find((h) => h.domain === p.domain); } catch (e) { throw this.http(e); }
      if (!hit || hit.status !== 'AVAILABLE') throw new ConflictException(err('DOMAIN_NOT_AVAILABLE', 'That domain is not available.'));
      const q = await this.quote(vendorId, { domain: p.domain, years: input.years, privacy: input.privacy === true });
      if (input.expectedTotalPaise !== q.totalPaise) throw new ConflictException(err('DOMAIN_PRICE_CHANGED', 'The price changed. Please look at the new price and confirm again.', { totalPaise: q.totalPaise }));
      await this.needReserve(vendorId, q.costPaise, s);
      const id = randomUUID();
      const now = this.clock();
      let row: OrderRow;
      try {
        row = await this.store.unit(vendorId, async (t, wtx) => {
          const created = await t.insertOrder({
            id, vendorId, kind: 'REGISTER', domain: p.domain, tld: p.tld, years: q.years, registeredDomainId: null, amountPaise: q.totalPaise, costPaise: q.costPaise, marginPaise: q.marginPaise, privacyPaise: q.privacyPaise, taxSnapshot: q.taxSnapshot,
            privacy: input.privacy === true, requestedByType: by.type, requestedById: by.actor.id, reason: by.reason?.trim() ?? null, idempotencyKey: key, openKey: p.domain,
          });
          const hold = await postEntry(wtx, { kind: 'HOLD', amountPaise: q.totalPaise, idempotencyKey: `domainhold:${vendorId}:${key}`, refType: 'domain_order', refId: id, actor: { type: by.actor.type, id: by.actor.id }, now });
          const held = await t.updateOrder(created.id, ['CREATED'], { status: nextOrder('CREATED', 'HOLD_PLACED')!, holdLedgerId: hold.entry.id });
          await t.audit(by.actor, 'domain.order.created', id, null, { domain: p.domain, years: q.years, amountPaise: q.totalPaise, by: by.type, ...(by.reason ? { reason: by.reason.trim() } : {}) });
          return held!;
        });
      } catch (e) {
        if (e instanceof WalletRuleError) throw walletHttpError(e, { minPaise: (await this.walletSettings.get()).walletTopupMinPaise, maxPaise: (await this.walletSettings.get()).walletTopupMaxPaise });
        if (e instanceof DuplicateOrderError) { if (e.which === 'NAME') throw new ConflictException(err('DOMAIN_NOT_AVAILABLE', 'That domain is not available.')); const dup = await this.store.orderByKey(vendorId, key); if (dup) return { row: dup, replay: true }; }
        throw e;
      }
      return { row: await this.submitAndSettle(row, reg, s, by.actor), replay: false };
    });
    return { ...orderView(out.row), replay: out.replay };
  }

  private replay(prior: OrderRow, domain: string, years: number) {
    if (prior.domain !== domain || prior.years !== years) throw new ConflictException(walletError('WALLET_IDEMPOTENCY_CONFLICT', 'That request key was already used for a different purchase.'));
    return { ...orderView(prior), replay: true };
  }

  /** A low reseller balance blocks the purchase and tells staff (an activity event on the vendor that hit it; the alert rule for domain events picks it up). */
  private async needReserve(vendorId: string, costPaise: number, s: RegistrarSettings): Promise<void> {
    let balance: number; try { balance = await this.port.balance(); } catch (e) { throw this.http(e); }
    if (balance - costPaise < s.registrarMinBalancePaise!) {
      this.logger.warn('registrar balance is below the minimum: purchases are blocked');
      this.emit('domain.registrar_balance_low', vendorId, SYSTEM, { blocked: true });
      throw new ConflictException(err('REGISTRAR_BALANCE_LOW', 'Domain buying is paused for now. Please try again later.'));
    }
  }

  /** Customer and contact, then SUBMITTED, then the registrar, then settle. The hold is already in place. */
  private async submitAndSettle(order: OrderRow, reg: NonNullable<Awaited<ReturnType<RegistrarStore['registrant']>>>, s: RegistrarSettings, actor: Actor): Promise<OrderRow> {
    let customer;
    try { customer = await this.ensureCustomer(order.vendorId, reg); } catch (e) { return this.failOrder(order, e instanceof RegistrarError ? e.code : 'REGISTRAR_ERROR', actor); }   // nothing was bought: give the hold back
    const submitted = await this.store.unit(order.vendorId, (t) => t.updateOrder(order.id, ['HELD'], { status: nextOrder('HELD', 'SUBMITTED')! }));
    if (!submitted) return (await this.store.order(order.vendorId, order.id)) ?? order;
    let res;
    try {
      res = await this.port.register({ domain: order.domain, years: order.years, customerId: customer.rcCustomerId, contactId: customer.rcContactId, nameServers: s.registrarNameServers!, privacy: order.privacy });
    } catch (e) {
      // Only a DEFINITE refusal releases the hold. An unsure answer, or any error we did not expect (it may have been thrown after the request was sent), keeps the hold and waits for recovery.
      if (!(e instanceof RegistrarError) || e.ambiguous) return this.markUnknown(submitted, e instanceof RegistrarError ? e.code : 'REGISTRAR_ERROR');
      return this.failOrder(submitted, e.code, actor);
    }
    return this.completeOrder(submitted, res.orderId, actor);
  }

  private async ensureCustomer(vendorId: string, reg: NonNullable<Awaited<ReturnType<RegistrarStore['registrant']>>>) {
    const have = await this.store.customer(vendorId);
    if (have) return have;
    const d: RegistrantDetails = { name: reg.legalName, company: reg.company, email: reg.email, addressLine1: reg.addressLine1, city: reg.city, state: reg.state, country: reg.country, zipcode: reg.zipcode, phoneCc: reg.phoneCc, phone: reg.phone };
    const rcCustomerId = await this.port.createCustomer(d);
    const rcContactId = await this.port.createContact(rcCustomerId, d);
    return this.store.saveCustomer(vendorId, rcCustomerId, rcContactId);
  }

  private async markUnknown(order: OrderRow, code: string): Promise<OrderRow> {
    const next = nextOrder(order.status, 'REGISTRAR_UNSURE');
    if (!next) return order;
    return (await this.store.unit(order.vendorId, (t) => t.updateOrder(order.id, [order.status], { status: next, failureCode: code }))) ?? order;
  }

  /** The hold goes back automatically: a RELEASE entry (not a refund: the money never left the wallet) and the order FAILED, in one unit. Safe to run again. */
  private async failOrder(order: OrderRow, code: string, actor: Actor): Promise<OrderRow> {
    const out = await this.store.unit(order.vendorId, async (t, wtx) => {
      const cur = await t.order(order.id);
      if (!cur) return order;
      const to = nextOrder(cur.status, cur.status === 'HELD' || cur.status === 'CREATED' ? 'NOT_SUBMITTED' : 'REGISTRAR_REFUSED');
      if (!to) return cur;
      let releaseId: string | null = null;
      if (cur.holdLedgerId) releaseId = (await postEntry(wtx, { kind: 'RELEASE', amountPaise: cur.amountPaise, holdId: cur.holdLedgerId, idempotencyKey: `domainrelease:${cur.id}`, refType: 'domain_order', refId: cur.id, reason: 'the domain could not be bought', actor: { type: 'SYSTEM', id: null }, now: this.clock() })).entry.id;
      const done = await t.updateOrder(cur.id, [cur.status], { status: to, failureCode: code, releaseLedgerId: releaseId, openKey: null });
      await t.audit(actor, 'domain.order.failed', cur.id, { status: cur.status }, { status: to, code, released: releaseId !== null });
      return done ?? cur;
    });
    this.emit('domain.purchase_failed', out.vendorId, actor, { domain: out.domain, code });
    return out;
  }

  /** Charges the hold, records or extends the domain, issues the invoice and adopts the name, in ONE unit. A failure inside it rolls everything back and the order stays as it was (recovery settles it). */
  private async completeOrder(order: OrderRow, rcOrderId: string | null, actor: Actor, expiresOverride: Date | null = null): Promise<OrderRow> {
    let expires: Date | null = expiresOverride;
    if (order.kind === 'REGISTER' && !expires) { try { expires = (await this.port.orderInfo(order.domain)).expiresAt; } catch { expires = null; } }
    const s = await this.settings.get(); const now = this.clock(); let domainId: string | null = null;
    const done = await this.store.unit(order.vendorId, async (t, wtx) => {
      const cur = await t.order(order.id);
      if (!cur) return order;
      const to = nextOrder(cur.status, 'REGISTRAR_OK');
      if (!to) return cur;
      const charge = await postEntry(wtx, { kind: 'CHARGE', amountPaise: cur.amountPaise, holdId: cur.holdLedgerId!, idempotencyKey: `domaincharge:${cur.id}`, refType: 'domain_order', refId: cur.id, reason: cur.kind === 'RENEW' ? 'domain renewed' : 'domain registered', actor: { type: 'SYSTEM', id: null }, now });
      let regId = cur.registeredDomainId;
      if (cur.kind === 'REGISTER') {
        const row = (await t.registeredByDomain(cur.domain)) ?? (await t.insertRegistered({ vendorId: cur.vendorId, domain: cur.domain, tld: cur.tld, rcOrderId, expiresAt: expires ?? addYears(now, cur.years), privacy: cur.privacy, nameServers: s.registrarNameServers ?? [] }));
        regId = row.id; domainId = await t.adoptDomain(cur.domain, now);
      } else if (regId) {
        const r = await t.registered(regId);
        if (r) await t.updateRegistered(regId, { status: 'ACTIVE', expiresAt: expires ?? addYears(r.expiresAt ?? now, cur.years), lastRenewedAt: now, alertsSent: [] });
      }
      const fy = financialYearOf(now); const n = await wtx.nextNumber('DOMAIN_INVOICE', fy);
      await t.insertInvoice({ vendorId: cur.vendorId, orderId: cur.id, number: formatInvoiceNumber('DINV', fy, n), financialYear: fy, totalPaise: cur.amountPaise, issuedAt: now, snapshot: { domain: cur.domain, kind: cur.kind, years: cur.years, ...cur.taxSnapshot } });
      const updated = await t.updateOrder(cur.id, [cur.status], { status: to, chargeLedgerId: charge.entry.id, rcOrderId, registeredDomainId: regId, failureCode: null });
      await t.audit(actor, 'domain.order.completed', cur.id, { status: cur.status }, { status: to, amountPaise: cur.amountPaise });
      return updated ?? cur;
    });
    if (done.status === 'COMPLETED') {
      this.emit(order.kind === 'RENEW' ? 'domain.renewed' : 'domain.registered', done.vendorId, actor, { domain: done.domain, orderId: done.id });
      if (order.kind === 'REGISTER' && domainId && this.conn) { try { await this.conn.begin(done.vendorId, domainId, { mode: 'CONNECT' }, SYSTEM); } catch (e) { this.logger.warn(`automatic connection not started for ${done.id}: ${e instanceof Error ? e.name : 'error'}`); } }
    }
    return done;
  }

  // ───────────────────────────────────────────────────────────────────────────── renewal (before expiry only)
  async renew(vendorId: string, registeredId: string, input: RenewInput, by: PurchaseBy) {
    const key = String(input.idempotencyKey ?? '');
    if (!KEY.test(key)) throw new BadRequestException(err('DOMAIN_INVALID', 'The request key must be 8 to 80 letters, digits, dashes, colons or underscores.'));
    const prior = await this.store.orderByKey(vendorId, key);
    const r0 = await this.store.registeredOne(vendorId, registeredId);
    if (!r0) throw new NotFoundException(err('DOMAIN_NOT_FOUND', 'That domain does not exist.'));
    if (prior) return this.replay(prior, r0.domain, Number(input.years));
    await this.wallet.syncActivation(vendorId);
    await this.needPro(vendorId);
    const s = await this.settings.get();
    if (s.registrarMinBalancePaise === null) throw new ConflictException(err('REGISTRAR_NOT_CONFIGURED', 'Domain buying is not set up yet.'));
    const out = await registrarQueue.run(registrarKey(vendorId), async () => {
      const again = await this.store.orderByKey(vendorId, key);
      if (again) return { row: again, replay: true };
      const r = await this.store.registeredOne(vendorId, registeredId);
      if (!r) throw new NotFoundException(err('DOMAIN_NOT_FOUND', 'That domain does not exist.'));
      // Renewal is before expiry only. An expired domain has no cheaper path here: it is not renewed through this route at all.
      if (r.status !== 'ACTIVE' || !renewalAllowed(r.expiresAt, this.clock())) throw new ConflictException(err('DOMAIN_EXPIRED', 'This domain has expired and can no longer be renewed here. Please contact support.'));
      const q = await this.quote(vendorId, { domain: r.domain, years: input.years, privacy: r.privacy }, 'RENEW');
      if (input.expectedTotalPaise !== q.totalPaise) throw new ConflictException(err('DOMAIN_PRICE_CHANGED', 'The price changed. Please look at the new price and confirm again.', { totalPaise: q.totalPaise }));
      await this.needReserve(vendorId, q.costPaise, s);
      const id = randomUUID(); const now = this.clock();
      let row: OrderRow;
      try {
        row = await this.store.unit(vendorId, async (t, wtx) => {
          const created = await t.insertOrder({ id, vendorId, kind: 'RENEW', domain: r.domain, tld: r.tld, years: q.years, registeredDomainId: r.id, amountPaise: q.totalPaise, costPaise: q.costPaise, marginPaise: q.marginPaise, privacyPaise: q.privacyPaise, taxSnapshot: q.taxSnapshot, privacy: r.privacy, requestedByType: by.type, requestedById: by.actor.id, reason: by.reason?.trim() ?? null, idempotencyKey: key, openKey: null });
          const hold = await postEntry(wtx, { kind: 'HOLD', amountPaise: q.totalPaise, idempotencyKey: `domainhold:${vendorId}:${key}`, refType: 'domain_order', refId: id, actor: { type: by.actor.type, id: by.actor.id }, now });
          const held = await t.updateOrder(created.id, ['CREATED'], { status: 'HELD', holdLedgerId: hold.entry.id });
          await t.audit(by.actor, 'domain.order.created', id, null, { domain: r.domain, years: q.years, kind: 'RENEW', amountPaise: q.totalPaise });
          return held!;
        });
      } catch (e) {
        if (e instanceof WalletRuleError) throw walletHttpError(e, { minPaise: (await this.walletSettings.get()).walletTopupMinPaise, maxPaise: (await this.walletSettings.get()).walletTopupMaxPaise });
        if (e instanceof DuplicateOrderError) { const dup = await this.store.orderByKey(vendorId, key); if (dup) return { row: dup, replay: true }; }
        throw e;
      }
      const submitted = await this.store.unit(vendorId, (t) => t.updateOrder(row.id, ['HELD'], { status: 'SUBMITTED' }));
      if (!submitted) return { row: (await this.store.order(vendorId, row.id)) ?? row, replay: false };
      try {
        const res = await this.port.renew(r.rcOrderId ?? '', q.years, r.expiresAt!);
        return { row: await this.completeOrder(submitted, r.rcOrderId, by.actor, res.expiresAt), replay: false };
      } catch (e) {
        if (!(e instanceof RegistrarError) || e.ambiguous) return { row: await this.markUnknown(submitted, e instanceof RegistrarError ? e.code : 'REGISTRAR_ERROR'), replay: false };
        return { row: await this.failOrder(submitted, e.code, by.actor), replay: false };
      }
    });
    return { ...orderView(out.row), replay: out.replay };
  }

  /** The exact price of renewing one of the vendor's own domains (the renewal cost, its privacy choice carried over). */
  async renewQuote(vendorId: string, registeredId: string, years: number): Promise<Quote> {
    const r = await this.store.registeredOne(vendorId, registeredId);
    if (!r) throw new NotFoundException(err('DOMAIN_NOT_FOUND', 'That domain does not exist.'));
    return this.quote(vendorId, { domain: r.domain, years, privacy: r.privacy }, 'RENEW');
  }

  // ───────────────────────────────────────────────────────────────────────────── reads
  async ordersForVendor(vendorId: string, page: number, pageSize: number) { const r = await this.store.ordersForVendor(vendorId, (page - 1) * pageSize, pageSize); return { items: r.items.map(orderView), page, pageSize, total: r.total }; }
  async orderForVendor(vendorId: string, id: string) {
    const o = typeof id === 'string' && id ? await this.store.order(vendorId, id) : null;
    if (!o) throw new NotFoundException(err('DOMAIN_ORDER_NOT_FOUND', 'That order does not exist.'));
    const inv = o.status === 'COMPLETED' ? await this.store.invoiceForOrder(vendorId, o.id) : null;
    return { ...orderView(o), invoice: inv ? { number: inv.number, issuedAt: inv.issuedAt, totalPaise: inv.totalPaise, lines: inv.snapshot.lines ?? [], taxPaise: inv.snapshot.taxMinor ?? 0, taxablePaise: inv.snapshot.taxableMinor ?? null } : null };
  }
  async registeredForVendor(vendorId: string) { return (await this.store.registeredForVendor(vendorId)).map(registeredView); }
  async ordersForStaff(q: { vendorId?: string; status?: OrderStatus; kind?: OrderKind }, page: number, pageSize: number) {
    const r = await this.store.ordersForStaff(q, (page - 1) * pageSize, pageSize);
    return { items: r.items.map((o) => ({ ...orderView(o), vendorId: o.vendorId, costPaise: o.costPaise, marginPaise: o.marginPaise, privacyPaise: o.privacyPaise, requestedByType: o.requestedByType, rcOrderId: o.rcOrderId })), page, pageSize, total: r.total };
  }

  // ───────────────────────────────────────────────────────────────────────────── price book (staff)
  async margins() { return (await this.store.margins()).map((m) => ({ id: m.id, tld: m.tld, kind: m.kind, value: m.value, status: m.status, effectiveFrom: m.effectiveFrom, note: m.note, approvedAt: m.approvedAt })); }
  async proposeMargin(input: { tld: string; kind: string; value: number; note?: string }, actor: Actor) {
    const tld = String(input.tld ?? '').trim().toLowerCase();
    const okTld = tld === 'privacy' || /^[a-z]{2,63}(\.[a-z]{2,63})?$/.test(tld);
    const kindOk = input.kind === 'PERCENT_BP' || input.kind === 'FIXED_PAISE';
    if (!okTld || !kindOk || !Number.isSafeInteger(input.value) || input.value < 0 || (input.kind === 'PERCENT_BP' && input.value > 100_000) || (tld === 'privacy' && input.kind !== 'FIXED_PAISE')) throw new BadRequestException(err('MARGIN_INVALID', 'Check the extension, the kind and the value (basis points for a percentage, whole paise for a fixed amount; privacy protection is a fixed price).'));
    const row = await this.store.insertMargin({ tld, kind: input.kind as 'PERCENT_BP' | 'FIXED_PAISE', value: input.value, note: input.note?.slice(0, 300) ?? null, createdBy: actor.id });
    if (!row) throw new ConflictException(err('MARGIN_STATE_INVALID', 'That could not be saved.'));
    return row;
  }
  async approveMargin(id: string, effectiveFromIso: string, actor: Actor) {
    const at = new Date(effectiveFromIso);
    if (Number.isNaN(at.getTime())) throw new BadRequestException(err('MARGIN_INVALID', 'An effective date is required to approve.'));
    const m = await this.store.getMargin(id);
    if (!m) throw new NotFoundException(err('MARGIN_NOT_FOUND', 'That price does not exist.'));
    const done = await this.store.updateMargin(id, ['PROPOSED'], { status: 'APPROVED', effectiveFrom: at, approvedBy: actor.id, approvedAt: this.clock() });
    if (!done) throw new ConflictException(err('MARGIN_STATE_INVALID', 'Only a proposed price can be approved, and the same extension cannot start twice on one date.'));
    return done;
  }
  async rejectMargin(id: string) {
    const done = await this.store.updateMargin(id, ['PROPOSED'], { status: 'REJECTED' });
    if (!done) throw new ConflictException(err('MARGIN_STATE_INVALID', 'Only a proposed price can be rejected.'));
    return done;
  }

  // ───────────────────────────────────────────────────────────────────────────── recovery and reconciliation
  /**
   * Settles orders that were left unfinished (a crash, or an unsure answer from the registrar). Each runs in the vendor's own queue slot. HELD means nothing was ever sent: the hold is released.
   * SUBMITTED and UNKNOWN are checked against the registrar: found means charge, definitely absent means release, anything else is left alone for the next run.
   */
  async recover(olderThanMinutes: number, actor: Actor = SYSTEM): Promise<{ settled: number; released: number; left: number }> {
    const before = new Date(this.clock().getTime() - olderThanMinutes * 60_000); let settled = 0; let released = 0; let left = 0;
    for (const o of await this.store.unsettledOrders(before, 100)) {
      const r = await registrarQueue.run(registrarKey(o.vendorId), () => this.recoverOne(o, actor));
      if (r === 'COMPLETED') settled++; else if (r === 'FAILED') released++; else left++;
    }
    return { settled, released, left };
  }

  private async recoverOne(o: OrderRow, actor: Actor): Promise<OrderStatus> {
    const cur = await this.store.order(o.vendorId, o.id);
    if (!cur || cur.status === 'COMPLETED' || cur.status === 'FAILED') return cur?.status ?? o.status;
    if (cur.status === 'HELD' || cur.status === 'CREATED') return (await this.failOrder(cur, 'NOT_SUBMITTED', actor)).status;
    let info;
    try { info = await this.port.orderInfo(cur.domain); } catch { return cur.status; }   // the registrar cannot be asked just now: try again next time
    if (cur.kind === 'REGISTER') {
      if ((info.status === 'ACTIVE' || info.status === 'EXPIRED') && info.orderId) return (await this.completeOrder(cur, info.orderId, actor)).status;
      if (info.status === 'NOT_FOUND' || info.status === 'FAILED') return (await this.failOrder(cur, 'NOT_FOUND_AT_REGISTRAR', actor)).status;
      return cur.status;
    }
    const reg = cur.registeredDomainId ? await this.store.registeredOne(cur.vendorId, cur.registeredDomainId) : null;
    if (!reg || !info.expiresAt) return cur.status;
    if (reg.expiresAt && info.expiresAt.getTime() > reg.expiresAt.getTime()) return (await this.completeOrder(cur, reg.rcOrderId, actor, info.expiresAt)).status;
    return (await this.failOrder(cur, 'NOT_RENEWED_AT_REGISTRAR', actor)).status;
  }

  /** The daily check of our books against the registrar: settles what recovery can, compares expiry and status, and looks at the reseller balance. A difference is written to the run and raised as an event; nothing is changed silently. */
  async reconcile(actor: Actor = SYSTEM) {
    const run = await this.store.insertRun(this.clock()); const mismatches: Array<Record<string, unknown>> = []; let checked = 0; let settled = 0;
    try {
      const rec = await this.recover(0, actor); settled += rec.settled + rec.released;
      for (const r of await this.store.activeRegistered(200)) {
        checked++;
        let info; try { info = await this.port.orderInfo(r.domain); } catch { continue; }
        if (info.status === 'NOT_FOUND' || info.status === 'FAILED') { mismatches.push({ domain: r.domain, vendorId: r.vendorId, kind: 'MISSING_AT_REGISTRAR' }); continue; }
        if (info.expiresAt && r.expiresAt && info.expiresAt.getTime() !== r.expiresAt.getTime()) {
          mismatches.push({ domain: r.domain, vendorId: r.vendorId, kind: 'EXPIRY_DIFFERS', local: r.expiresAt, remote: info.expiresAt });
          await this.store.patchRegistered(r.vendorId, r.id, { expiresAt: info.expiresAt }); settled++;
        }
      }
      let balance: number | null = null; try { balance = await this.port.balance(); } catch { balance = null; }
      const s = await this.settings.get();
      if (balance !== null && s.registrarMinBalancePaise !== null && balance < s.registrarMinBalancePaise) mismatches.push({ kind: 'RESERVE_BELOW_MINIMUM' });
      await this.store.finishRun(run.id, { finishedAt: this.clock(), checked, settled, mismatches, balancePaise: balance, status: 'DONE' });
      for (const m of mismatches) if (typeof m.vendorId === 'string') this.emit('domain.reconcile_mismatch', m.vendorId, actor, { domain: m.domain, kind: m.kind });
      return { id: run.id, checked, settled, mismatches: mismatches.length, balanceKnown: balance !== null };
    } catch (e) {
      await this.store.finishRun(run.id, { finishedAt: this.clock(), checked, settled, mismatches, status: 'FAILED', note: e instanceof Error ? e.name : 'error' });
      throw e;
    }
  }
  async runs() { return this.store.lastRuns(30); }

  // ───────────────────────────────────────────────────────────────────────────── expiry alerts
  /** Tells vendors their domain is near its end (the nearest threshold not yet sent) and marks a domain EXPIRED once it is. Both the site and the vendor's subdomain stay as they are: a lapsed domain never hides a site. */
  async expiryTick(): Promise<{ alerted: number; expired: number }> {
    const s = await this.settings.get(); const now = this.clock(); let alerted = 0; let expired = 0;
    for (const r of await this.store.activeRegistered(500)) {
      if (r.expiresAt && r.expiresAt.getTime() <= now.getTime()) { await this.store.patchRegistered(r.vendorId, r.id, { status: 'EXPIRED' }); this.emit('domain.expired', r.vendorId, SYSTEM, { domain: r.domain }); expired++; continue; }
      if (!r.expiresAt) continue;
      const due = expiryAlertDue(r.expiresAt, now, s.domainExpiryAlertDays, r.alertsSent);
      if (due === null) continue;
      await this.store.patchRegistered(r.vendorId, r.id, { alertsSent: [...new Set([...r.alertsSent, ...(s.domainExpiryAlertDays ?? []).filter((t) => t >= due)])] });
      this.emit('domain.expiry_alert', r.vendorId, SYSTEM, { domain: r.domain, thresholdDays: due, expiresAt: r.expiresAt }); alerted++;
    }
    return { alerted, expired };
  }
}

