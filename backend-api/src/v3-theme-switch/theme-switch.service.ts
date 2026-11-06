import { ConflictException, Injectable, Optional } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { ActivityBus } from '../common/activity-bus';
import { OtpPepper } from '../directory/pepper';
import { EntitlementsService } from '../plans/entitlements/entitlements.service';
import { Actor } from '../plans/admin/audit.service';
import { planStateAllows, PlanSnapshot, resolvePrice } from '../v3-services/core/services-core';
import { conflict as servicesConflict } from '../v3-services/services.errors';
import { DuplicateError, ServicesStore } from '../v3-services/services.store';
import { deductionOutcome } from '../v3-wallet/core/tax-core';
import { WalletRuleError } from '../v3-wallet/core/wallet-core';
import { WalletSettingsService } from '../v3-wallet/settings/wallet-settings.service';
import { postEntry } from '../v3-wallet/wallet-engine';
import { frozen, notActive, walletError, walletHttpError } from '../v3-wallet/wallet.errors';
import { V3WalletService } from '../v3-wallet/wallet.service';
import { KeyedQueue } from '../common/keyed-queue';
import { WalletStore } from '../v3-wallet/wallet.store';
import { feeDecision, hiddenFields, SwitchKind } from './core/theme-switch-core';
import { SitePipelinePort } from './site-pipeline.port';
import { themeConflict, themeError, themeInvalid, themeNotFound } from './theme-switch.errors';
import { DuplicateSwitchError, SwitchRow, ThemeSwitchStore } from './theme-switch.store';

const SYSTEM: Actor = { type: 'SYSTEM', id: null, ip: null };
const KEY = /^[A-Za-z0-9_:-]{8,80}$/;
const THEME_ID = /^[a-z0-9][a-z0-9._-]{1,80}$/i;
/** A technical limit, not a business value: how long a preview reference can be shown before the vendor must preview again. */
const PREVIEW_TTL_MS = 15 * 60_000;

export interface SwitchBy { type: 'VENDOR' | 'STAFF'; actor: Actor; funding: 'WALLET' | 'COMPLIMENTARY' | 'SERVICE_REQUEST'; reason?: string; serviceRequestId?: string }

const b64 = (s: string): string => Buffer.from(s, 'utf8').toString('base64url');

/**
 * The Theme Switch Service (slice 5.16d, owner rule 4). One theme is included in Pro (the first switch); every later switch is charged the Theme Switch Service fee from the price book; a staff gift and a restore
 * after a lapse are free and are not switches. Previewing a theme with the vendor's own content is free and stores nothing.
 *
 * Doing a switch is one saga, serialized per vendor in memory BEFORE any transaction: (1) one unit of work writes the PENDING switch row and, for a paid one, the wallet CHARGE (instant service: charged, not held);
 * (2) the existing settings, build and publish services apply the theme as a NEW publication snapshot (the previous one stays, so rollback stays possible); (3) one unit marks it APPLIED. If (2) fails, the stored
 * theme is put back and the charge is given back with a REVERSAL entry, so a vendor is never left charged for a switch that did not happen. A crash between (1) and (3) leaves a PENDING row that recoverStale
 * settles from the site's real state. Nothing the vendor wrote is ever removed: the theme only changes how the same content is drawn.
 */
/**
 * One switch of a vendor at a time, in memory, BEFORE any transaction (a waiting request holds no database connection). It is NOT the wallet queue: the wallet unit of work (store.unit) waits in the
 * wallet queue itself and takes the database lock, and the queue is not reentrant, so holding the wallet key here and then opening a unit would wait on ourselves for ever (found on staging, 6 November 2026).
 */
export const themeQueue = new KeyedQueue();
export const themeKey = (vendorId: string): string => `themeswitch:${vendorId}`;

@Injectable()
export class ThemeSwitchService {
  clock: () => Date = () => new Date();
  constructor(
    private readonly store: ThemeSwitchStore, private readonly pipeline: SitePipelinePort, private readonly services: ServicesStore, private readonly wallet: V3WalletService, private readonly walletStore: WalletStore,
    private readonly walletSettings: WalletSettingsService, private readonly entitlements: EntitlementsService, private readonly pepper: OtpPepper, @Optional() private readonly bus?: ActivityBus,
  ) {}

  private emit(type: string, vendorId: string, actor: Actor, data: Record<string, unknown>): void { void this.bus?.emit({ type, vendorId, at: this.clock(), actor: { type: actor.type, id: actor.id }, data }); }
  private async plan(vendorId: string): Promise<PlanSnapshot> { const r = await this.entitlements.resolve(vendorId); return { level: (r.level as PlanSnapshot['level']) ?? null, subscriptionStatus: r.subscriptionStatus, suspended: r.suspended }; }
  private sign(payload: string): string { return createHmac('sha256', this.pepper.value()).update(`theme-preview:${payload}`).digest('base64url'); }

  /** What the switch would cost, before the vendor confirms: the included switch, or the approved fee and how it would be paid. The fee carries no GST (it was added when the credit was added) and the charge no invoice (owner, 5 November 2026). A fee with no approved price says so and cannot be bought. */
  private async quote(vendorId: string, kind: SwitchKind) {
    if (kind !== 'PAID') return { kind, free: true as const, amountPaise: 0 };
    const svc = await this.services.serviceByKey('THEME_SWITCH');
    const price = svc ? resolvePrice(await this.services.servicePrices(svc.id), this.clock()) : null;
    if (!svc || !price) return { kind, free: false as const, priceNote: 'Price not set', funding: { kind: 'NONE', reason: 'PRICE_NOT_SET' } };
    const w = await this.walletStore.wallet(vendorId);
    const tax = deductionOutcome(price.amountPaise);
    const available = w ? w.balancePaise - w.heldPaise : 0;
    const funding = !w || w.status === 'INACTIVE' ? { kind: 'NONE', reason: 'WALLET_NOT_ACTIVE' } : w.status === 'FROZEN' ? { kind: 'NONE', reason: 'WALLET_FROZEN' }
      : !tax.ok ? { kind: 'NONE', reason: 'TAX_NOT_SET', taxProblem: tax.problem } : available < tax.totalMinor ? { kind: 'NONE', reason: 'INSUFFICIENT_WALLET', shortfallPaise: tax.totalMinor - available } : { kind: 'WALLET', amountPaise: tax.totalMinor };
    return { kind, free: false as const, price: { amountPaise: price.amountPaise, taxInclusive: price.taxInclusive }, tax: tax.ok ? { taxPaise: tax.taxMinor, totalPaise: tax.totalMinor, lines: tax.lines } : { problem: tax.problem }, amountPaise: tax.ok ? tax.totalMinor : null, funding };
  }

  // ───────────────────────────────────────────────────────────────────────────────────────── preview (free, stores nothing)
  async preview(vendorId: string, themeId: string) {
    if (typeof themeId !== 'string' || !THEME_ID.test(themeId)) throw themeInvalid('Choose a theme.');
    const snap = await this.pipeline.snapshot(vendorId);
    const elig = await this.pipeline.eligibility(vendorId, themeId);
    if (!elig.ok) throw themeConflict('THEME_NOT_ALLOWED', elig.message, { reason: elig.code });
    const [r, priors] = await Promise.all([this.pipeline.preview(vendorId, themeId), this.store.priors(vendorId)]);
    const exp = this.clock().getTime() + PREVIEW_TTL_MS; const payload = b64(JSON.stringify({ v: vendorId, t: themeId, e: exp }));
    const fee = await this.quote(vendorId, feeDecision(priors, { restore: false, staffComplimentary: false }).kind);
    return {
      themeId, current: snap.storedThemeId, alreadyActive: snap.storedThemeId === themeId, previewRef: `${payload}.${this.sign(payload)}`, expiresAt: new Date(exp), html: r.html, css: r.css, warnings: r.warnings,
      hiddenFields: hiddenFields(r.contentFields, r.usedFields ? new Set(r.usedFields) : null), fee,
    };
  }
  /** Is this reference one we signed, for this vendor, and still fresh? (Used to show a preview again; a reference grants nothing else.) */
  verifyPreviewRef(vendorId: string, ref: string): { themeId: string } | null {
    const [payload, sig] = String(ref ?? '').split('.');
    if (!payload || !sig) return null;
    const want = Buffer.from(this.sign(payload)); const got = Buffer.from(sig);
    if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
    try { const p = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { v: string; t: string; e: number }; return p.v === vendorId && p.e > this.clock().getTime() ? { themeId: p.t } : null; } catch { return null; }
  }

  // ───────────────────────────────────────────────────────────────────────────────────────── the switch
  async switchTheme(vendorId: string, input: { themeId: string; idempotencyKey: string }, by: SwitchBy) {
    const key = String(input.idempotencyKey ?? ''); const themeId = String(input.themeId ?? '');
    if (!KEY.test(key)) throw themeInvalid('The request key must be 8 to 80 letters, digits, dashes, colons or underscores.');
    if (!THEME_ID.test(themeId)) throw themeInvalid('Choose a theme.');
    if (by.funding === 'COMPLIMENTARY' && !(typeof by.reason === 'string' && by.reason.trim().length >= 5)) throw themeInvalid('A reason of at least 5 characters is required for a complimentary switch.');
    if (by.funding === 'SERVICE_REQUEST' && !by.serviceRequestId) throw themeInvalid('Name the service request that carries the fee.');
    await this.wallet.syncActivation(vendorId);
    const ws = await this.walletSettings.get(); const limits = { minPaise: ws.walletTopupMinPaise, maxPaise: ws.walletTopupMaxPaise };

    const out = await themeQueue.run(themeKey(vendorId), async () => {
      const prior = await this.store.findByKey(vendorId, key);
      if (prior) { if (prior.toThemeKey !== themeId) throw new ConflictException(walletError('WALLET_IDEMPOTENCY_CONFLICT', 'That request key was already used for a different theme.')); return { row: prior, replay: true }; }
      const snap = await this.pipeline.snapshot(vendorId);
      if (snap.storedThemeId === themeId) throw themeConflict('THEME_ALREADY_ACTIVE', 'That theme is already your theme.');
      if (!planStateAllows('PRO_ACTIVE_OR_GRACE', await this.plan(vendorId))) throw themeConflict('THEME_SWITCH_PLAN_STATE', 'A theme can be switched only while your Pro plan is active.');
      const elig = await this.pipeline.eligibility(vendorId, themeId);
      if (!elig.ok) throw themeConflict('THEME_NOT_ALLOWED', elig.message, { reason: elig.code });
      const decision = feeDecision(await this.store.priors(vendorId), { restore: false, staffComplimentary: by.funding === 'COMPLIMENTARY' });
      if (by.funding === 'SERVICE_REQUEST' && decision.kind !== 'PAID') throw themeConflict('THEME_SWITCH_FREE_USE_DIRECT', 'This switch is the one your plan includes, so it is free. Reject the request (the held amount is released) and switch directly.');
      if (by.funding === 'WALLET' && decision.kind === 'COMPLIMENTARY_STAFF') throw themeInvalid('Choose wallet or complimentary.');
      const q = await this.quote(vendorId, decision.kind === 'PAID' && by.funding !== 'SERVICE_REQUEST' ? 'PAID' : decision.kind === 'PAID' ? 'RESTORE' : decision.kind);
      if (decision.kind === 'PAID' && by.funding !== 'SERVICE_REQUEST') {
        const fund = (q as { funding?: { kind: string; reason?: string } }).funding;
        if (fund && fund.kind === 'NONE') {   // the wallet's own state comes first: a vendor whose wallet is not open is told that, not that a price or a tax rate is missing
          if (fund.reason === 'WALLET_NOT_ACTIVE') throw notActive();
          if (fund.reason === 'WALLET_FROZEN') throw frozen();
        }
        if (!('price' in q)) throw servicesConflict('SERVICE_PRICE_NOT_SET', 'The theme switch has no approved price yet, so it cannot be bought.');
        if ('tax' in q && q.tax && 'problem' in q.tax) throw new ConflictException(walletError('TAX_NOT_CONFIGURED', 'Tax is not set up yet, so this cannot be priced.', { problem: q.tax.problem }));
      }
      const fields = await this.pipeline.fieldsFor(vendorId, themeId);
      const hidden = hiddenFields(fields.contentFields, fields.usedFields ? new Set(fields.usedFields) : null);
      const id = randomUUID(); const now = this.clock();
      let row: SwitchRow;
      try {
        row = await this.store.unit(vendorId, async (t, _s, wtx) => {
          // THE decision, made where the vendor's lock is held: from this vendor's own rows read inside the unit's transaction, never from the earlier read above (which only produced the quote and the early refusals).
          // Two switches with different keys cannot both be the included one: the second runs after the first has been applied (themeQueue) and decides from its row; if the state changed under us in another process we refuse and the vendor retries.
          const final = feeDecision(await t.priors(), { restore: false, staffComplimentary: by.funding === 'COMPLIMENTARY' });
          if (final.kind !== decision.kind) throw themeConflict('THEME_SWITCH_RETRY', 'Your site changed while we were preparing this switch. Nothing was charged. Please try again.');
          if (by.funding === 'SERVICE_REQUEST' && !(await t.requestCarriesFee(by.serviceRequestId!, themeId))) throw themeConflict('THEME_SWITCH_INVALID', 'That service request does not carry this switch (it must be this vendor\'s open theme switch request for this theme).');
          let ledgerEntryId: string | null = null; let priceSnapshotPaise: number | null = null; let taxSnapshot: Record<string, unknown> = {};
          if (decision.kind === 'PAID' && by.funding !== 'SERVICE_REQUEST' && 'amountPaise' in q && q.amountPaise) {
            const charge = await postEntry(wtx, { kind: 'CHARGE', amountPaise: q.amountPaise, idempotencyKey: `themeswitch:${vendorId}:${key}`, refType: 'theme_switch', refId: id, actor: { type: by.actor.type, id: by.actor.id }, now });
            ledgerEntryId = charge.entry.id; priceSnapshotPaise = q.amountPaise; taxSnapshot = { price: 'price' in q ? q.price : null, tax: 'tax' in q ? q.tax : null };
          }
          const created = await t.insert({
            id, vendorId, siteId: null, fromThemeKey: snap.storedThemeId, toThemeKey: themeId, kind: decision.kind, performedByType: by.type, performedById: by.actor.id, serviceRequestId: by.serviceRequestId ?? null, ledgerEntryId,
            packPurchaseId: null, priceSnapshotPaise, taxSnapshot, status: 'PENDING', idempotencyKey: key, reason: by.reason?.trim() ?? null, hiddenFields: hidden,
          });
          await t.audit(by.actor, by.type === 'STAFF' ? 'theme_switch.start_for_vendor' : 'theme_switch.start', id, null, { from: snap.storedThemeId, to: themeId, kind: decision.kind, amountPaise: priceSnapshotPaise, ...(by.reason ? { reason: by.reason.trim() } : {}) });
          return created;
        });
      } catch (e) {
        if (e instanceof WalletRuleError) throw walletHttpError(e, limits);
        if (e instanceof DuplicateSwitchError || e instanceof DuplicateError) throw new ConflictException(walletError('WALLET_IDEMPOTENCY_CONFLICT', 'That request key was already used.'));
        throw e;
      }
      try {
        const applied = await this.pipeline.apply(vendorId, themeId, by.actor);
        await this.store.unit(vendorId, (t) => t.updateCas(row.id, ['PENDING'], { status: 'APPLIED', publicationId: applied.publicationId }));
        return { row: { ...row, status: 'APPLIED' as const, publicationId: applied.publicationId }, replay: false };
      } catch (e) {
        await this.compensate(vendorId, row, snap.storedThemeId, e);
        throw themeConflict('THEME_SWITCH_FAILED', 'We could not switch your theme, so nothing was changed and nothing was charged. Please try again.');
      }
    });
    if (!out.replay) this.emit('theme.switched', vendorId, by.actor, { switchId: out.row.id, kind: out.row.kind, to: out.row.toThemeKey });
    return { ...this.view(out.row), replay: out.replay };
  }

  /** Puts the stored theme back and gives a charge back with a REVERSAL entry (not a refund: the money never left the wallet), then marks the switch FAILED. Safe to run again. */
  private async compensate(vendorId: string, row: SwitchRow, previousStored: string | null, cause: unknown, o: { revertOnlyIf?: string } = {}): Promise<void> {
    // In the live saga the vendor's queue is held, so the stored theme is put back unconditionally. When settling an OLD stuck switch the vendor may have switched again since: then the stored theme is left alone
    // (it is only reverted while the site is still on the stuck switch's own theme), so recovery can never undo a newer, good switch.
    try { if (o.revertOnlyIf === undefined || (await this.pipeline.snapshot(vendorId)).storedThemeId === o.revertOnlyIf) await this.pipeline.setStored(vendorId, previousStored); } catch { /* the reversal below still happens; staff see the failed row */ }
    await this.store.unit(vendorId, async (t, _s, wtx) => {
      const cur = await t.get(row.id);
      if (!cur || cur.status !== 'PENDING') return;
      if (cur.ledgerEntryId && cur.priceSnapshotPaise) await postEntry(wtx, { kind: 'REVERSAL', amountPaise: cur.priceSnapshotPaise, reversesId: cur.ledgerEntryId, idempotencyKey: `themeswitch-reverse:${cur.id}`, refType: 'theme_switch', refId: cur.id, reason: 'the theme switch could not be completed', actor: { type: 'SYSTEM', id: null }, now: this.clock() });
      await t.updateCas(cur.id, ['PENDING'], { status: 'FAILED', failureReason: cause instanceof Error ? cause.name : 'error' });
      await t.audit(SYSTEM, 'theme_switch.failed', cur.id, { status: 'PENDING' }, { status: 'FAILED', reversed: !!cur.ledgerEntryId });
    });
  }

  /** Settles switches that were left PENDING by a crash: if the site really shows the new theme the switch is APPLIED, otherwise it is undone and any charge reversed. Staff trigger it with a cut-off. */
  async recoverStale(olderThanMinutes: number) {
    const before = new Date(this.clock().getTime() - olderThanMinutes * 60_000); let applied = 0; let reversed = 0;
    for (const r of await this.store.stalePending(before, 50)) {
      // one vendor at a time, in the same in-process queue a live switch waits in, so recovery cannot race a switch that is happening now
      await themeQueue.run(themeKey(r.vendorId), async () => {
        const cur = (await this.store.findByKey(r.vendorId, r.idempotencyKey)); if (!cur || cur.status !== 'PENDING') return;
        const snap = await this.pipeline.snapshot(r.vendorId);
        if (snap.storedThemeId === r.toThemeKey && (snap.publishedThemeId === r.toThemeKey || !snap.hasPublished)) { await this.store.unit(r.vendorId, (t) => t.updateCas(r.id, ['PENDING'], { status: 'APPLIED' })); applied++; }
        else { await this.compensate(r.vendorId, r, r.fromThemeKey, new Error('recovered'), { revertOnlyIf: r.toThemeKey }); reversed++; }
      });
    }
    return { applied, reversed };
  }

  // ───────────────────────────────────────────────────────────────────────────────────────── restore after a lapse
  /** When Pro returns and the stored theme is not the one published (it fell back during the lapse), the stored theme is applied again. No charge, and it is not counted as a switch. */
  async restoreIfNeeded(vendorId: string) {
    if (!planStateAllows('PRO_ACTIVE_OR_GRACE', await this.plan(vendorId))) return null;
    const res = await themeQueue.run(themeKey(vendorId), () => this.pipeline.restore(vendorId, SYSTEM));
    if (!res) return null;
    try {
      await this.store.unit(vendorId, async (t) => {
        const row = await t.insert({ id: randomUUID(), vendorId, siteId: null, fromThemeKey: null, toThemeKey: res.themeId, kind: 'RESTORE', performedByType: 'SYSTEM', performedById: null, serviceRequestId: null, ledgerEntryId: null, packPurchaseId: null, priceSnapshotPaise: null, taxSnapshot: {}, status: 'APPLIED', idempotencyKey: `restore:${res.publicationId}`, reason: null, hiddenFields: [] });
        await t.updateCas(row.id, ['APPLIED'], { publicationId: res.publicationId });
        await t.audit(SYSTEM, 'theme_switch.restore', row.id, null, { to: res.themeId, publicationId: res.publicationId });
      });
    } catch (e) { if (!(e instanceof DuplicateSwitchError)) throw e; }
    this.emit('theme.restored', vendorId, SYSTEM, { themeId: res.themeId });
    return res;
  }

  // ───────────────────────────────────────────────────────────────────────────────────────── views
  private view(r: SwitchRow) {
    return {
      id: r.id, from: r.fromThemeKey, to: r.toThemeKey, kind: r.kind, status: r.status, by: r.performedByType === 'VENDOR' ? 'YOU' : r.performedByType === 'STAFF' ? 'OUR_TEAM' : 'SYSTEM', amountPaise: r.priceSnapshotPaise, viaRequest: r.serviceRequestId !== null,
      reason: r.kind === 'COMPLIMENTARY_STAFF' ? r.reason : null, note: r.status === 'FAILED' ? 'This switch could not be completed. Nothing was changed and nothing was charged.' : null, publicationId: r.publicationId, hiddenFields: r.hiddenFields, at: r.createdAt,
    };
  }
  async history(vendorId: string, page: number, pageSize: number) { const r = await this.store.listForVendor(vendorId, (page - 1) * pageSize, pageSize); return { items: r.items.map((x) => this.view(x)), page, pageSize, total: r.total }; }
  async adminHistory(vendorId: string, page: number, pageSize: number) {
    const r = await this.store.listForVendor(vendorId, (page - 1) * pageSize, pageSize);
    return { items: r.items.map((x) => ({ ...this.view(x), performedById: x.performedById, ledgerEntryId: x.ledgerEntryId, serviceRequestId: x.serviceRequestId, idempotencyKey: x.idempotencyKey, failureReason: x.failureReason, reasonRaw: x.reason })), page, pageSize, total: r.total };
  }
}

export { themeError, themeNotFound, frozen, notActive };
