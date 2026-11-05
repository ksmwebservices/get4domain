import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ActivityBus } from '../common/activity-bus';
import { Actor } from '../plans/admin/audit.service';
import { financialYearOf, formatInvoiceNumber, verifyPaidAmount } from '../plan-billing/core/amounts';
import { billingError } from '../plan-billing/plan-billing.errors';
import { PaymentsGate } from '../plan-billing/razorpay/payments-gate';
import { BillingSettingsService } from '../plan-billing/settings/billing-settings.service';
import { TopupSettlementHook } from '../plan-billing/topup-hook';
import { activationDecision, ActivationEvidence, available, reconcile, topupAmountProblem, WalletRuleError } from './core/wallet-core';
import { expireWallet, postEntry } from './wallet-engine';
import { frozen, notActive, TopupLimits, walletError, walletHttpError } from './wallet.errors';
import { DuplicateTopupError, LedgerRow, TopupRow, WalletRow, WalletStore } from './wallet.store';
import { WalletSettingsService } from './settings/wallet-settings.service';

export type SettleTopupOutcome = 'CREDITED' | 'ALREADY_PAID' | 'REVIEW' | 'IGNORED' | 'NO_TOPUP';
const SYSTEM: Actor = { type: 'SYSTEM', id: null, ip: null };
const LOCKED_TEXT = 'Your wallet opens after your first Pro plan term is paid.';

/** What a vendor sees of a ledger row: no staff identity, no lot detail. */
export const ledgerView = (e: LedgerRow) => ({
  id: e.id, entryNo: e.entryNo, kind: e.kind, amountPaise: e.amountPaise, balanceAfterPaise: e.balanceAfterPaise, heldAfterPaise: e.heldAfterPaise,
  refType: e.refType, refId: e.refId, reason: e.reason, by: e.actorType, at: e.at,
});
const topupView = (t: TopupRow, keyId: string | null = null) => ({
  id: t.id, amountPaise: t.amountPaise, currency: t.currency, status: t.status, providerOrderId: t.providerOrderId, keyId, expiresAt: t.expiresAt, paidAt: t.paidAt, receiptId: t.receiptId, createdAt: t.createdAt,
});

/**
 * The V3 wallet (slice 5.16a). Get4Domain's own revenue only: this wallet never holds or moves a customer's payment for a vendor's goods or services. It shares nothing with the legacy
 * wallet (src/wallet): its own tables, its own ledger, its own rules (decision D1).
 *   - It opens (ACTIVE) only after the vendor's first Pro term is PAID. Free vendors see a locked preview. The state is also derived from the data (paidProEvidence), so a missed event can
 *     never leave a paying vendor without a wallet.
 *   - A top-up is paid through the existing payment provider seam; the browser's word is never trusted, the provider is asked.
 *   - Every change goes through postEntry (the one writer of the ledger) inside a unit of work. Settings are read BEFORE a unit opens, never inside one.
 */
@Injectable()
export class V3WalletService implements TopupSettlementHook {
  clock: () => Date = () => new Date();
  constructor(
    private readonly store: WalletStore, private readonly settings: WalletSettingsService, private readonly billing: BillingSettingsService, private readonly gate: PaymentsGate,
    @Optional() private readonly bus?: ActivityBus,
  ) {}

  private async limits(): Promise<TopupLimits> { const s = await this.settings.get(); return { minPaise: s.walletTopupMinPaise, maxPaise: s.walletTopupMaxPaise }; }
  private emit(type: string, vendorId: string, actor: Actor, data: Record<string, unknown>): void { void this.bus?.emit({ type, vendorId, at: this.clock(), actor: { type: actor.type, id: actor.id }, data }); }

  // ───────────────────────────────────────────────────────────────────────────────────────── activation (owner rule 2)
  /** Opens the wallet for a vendor whose first Pro term is paid. Idempotent: the INACTIVE to ACTIVE change happens exactly once, whoever calls and however many race. */
  async activate(vendorId: string, eventId: string): Promise<boolean> {
    const now = this.clock();
    const changed = await this.store.unit(vendorId, async (tx) => {
      await tx.ensureWallet();
      const did = await tx.activate(eventId, now);
      if (did) await tx.audit(SYSTEM, 'wallet.activated', vendorId, { status: 'INACTIVE' }, { status: 'ACTIVE', by: eventId });
      return did;
    });
    if (changed) this.emit('wallet.activated', vendorId, SYSTEM, { eventId });
    return changed;
  }

  /** The event listener's entry point (a plan order paid, or a subscription started). */
  async onEvidence(vendorId: string, evidence: ActivationEvidence, eventId: string): Promise<boolean> {
    return activationDecision(evidence) ? this.activate(vendorId, eventId) : false;
  }

  /** Derives the state from the data: a vendor with a paid Pro term has an ACTIVE wallet, whatever happened to the events. Free-only vendors stay without one. */
  async syncActivation(vendorId: string): Promise<WalletRow | null> {
    const w = await this.store.wallet(vendorId);
    if (w && w.status !== 'INACTIVE') return w;
    const ev = await this.store.paidProEvidence(vendorId);
    if (ev) { await this.activate(vendorId, `${ev.kind.toLowerCase()}:${ev.id}`); return this.store.wallet(vendorId); }
    return w;
  }

  // ───────────────────────────────────────────────────────────────────────────────────────── vendor reads
  async view(vendorId: string) {
    const w = await this.syncActivation(vendorId); const s = await this.settings.get();
    const status = w?.status ?? 'INACTIVE';
    const topupsReady = s.walletTopupMinPaise !== null && s.walletTopupMaxPaise !== null;
    return {
      status, locked: status !== 'ACTIVE', lockedReason: status === 'FROZEN' ? 'FROZEN' : status === 'INACTIVE' ? 'NO_PAID_PRO_TERM' : null,
      lockedText: status === 'FROZEN' ? 'This wallet is on hold. Please contact support.' : status === 'INACTIVE' ? LOCKED_TEXT : null,
      currency: 'INR', balancePaise: w?.balancePaise ?? 0, heldPaise: w?.heldPaise ?? 0, availablePaise: w ? available(w) : 0, activatedAt: w?.activatedAt ?? null,
      creditValidityDays: s.walletCreditValidityDays,
      topup: { enabled: status === 'ACTIVE' && topupsReady, configured: topupsReady, minPaise: s.walletTopupMinPaise, maxPaise: s.walletTopupMaxPaise },
      billingProfile: { stateCode: w?.billingStateCode ?? null, gstin: w?.billingGstin ?? null },
    };
  }

  async ledger(vendorId: string, page: number, pageSize: number) {
    const r = await this.store.ledgerPage(vendorId, (page - 1) * pageSize, pageSize);
    return { items: r.items.map(ledgerView), page, pageSize, total: r.total };
  }
  async topups(vendorId: string, page: number, pageSize: number) {
    const r = await this.store.topupsPage(vendorId, (page - 1) * pageSize, pageSize);
    return { items: r.items.map((t) => topupView(t)), page, pageSize, total: r.total };
  }

  async setBillingProfile(vendorId: string, input: { stateCode?: string | null; gstin?: string | null }, actor: Actor) {
    const stateCode = input.stateCode === undefined || input.stateCode === null || input.stateCode === '' ? null : String(input.stateCode);
    const gstin = input.gstin === undefined || input.gstin === null || input.gstin === '' ? null : String(input.gstin).toUpperCase();
    if (stateCode !== null && !/^[0-9]{2}$/.test(stateCode)) throw new BadRequestException(walletError('WALLET_PROFILE_INVALID', 'The state code must be two digits.'));
    if (gstin !== null && !/^[0-9A-Z]{15}$/.test(gstin)) throw new BadRequestException(walletError('WALLET_PROFILE_INVALID', 'The GST number must be 15 capital letters and digits.'));
    if (gstin !== null && stateCode !== null && gstin.slice(0, 2) !== stateCode) throw new BadRequestException(walletError('WALLET_PROFILE_INVALID', 'The GST number must start with the state code.'));
    await this.syncActivation(vendorId);
    await this.store.unit(vendorId, async (tx) => {
      const w = await tx.wallet(); if (!w || w.status === 'INACTIVE') throw notActive();
      await tx.setBillingProfile({ stateCode, gstin });
      await tx.audit(actor, 'wallet.billing_profile', vendorId, { stateCode: w.billingStateCode, gstin: w.billingGstin }, { stateCode, gstin });
    });
    return { stateCode, gstin };
  }

  // ───────────────────────────────────────────────────────────────────────────────────────── top-ups
  async createTopup(vendorId: string, input: { amountPaise: number; idempotencyKey: string }, actor: Actor) {
    const key = String(input.idempotencyKey ?? '');
    const w = await this.syncActivation(vendorId);
    if (!w || w.status === 'INACTIVE') throw notActive();
    if (w.status === 'FROZEN') throw frozen();
    const s = await this.settings.get(); const b = await this.billing.get();
    const problem = topupAmountProblem(input.amountPaise, s.walletTopupMinPaise, s.walletTopupMaxPaise);
    if (problem === 'NOT_CONFIGURED') throw new ConflictException(walletError('WALLET_TOPUP_NOT_CONFIGURED', 'Adding credit is not switched on yet.'));
    if (problem) throw new BadRequestException(walletError('WALLET_TOPUP_AMOUNT_INVALID', problem === 'INVALID' ? 'The amount must be a whole number of paise, more than zero.' : problem === 'BELOW_MINIMUM' ? 'That is less than the smallest amount you can add.' : 'That is more than the largest amount you can add at once.', { minTopupPaise: s.walletTopupMinPaise, maxTopupPaise: s.walletTopupMaxPaise }));

    const prior = await this.store.findTopupByIdempotency(vendorId, key);
    if (prior) return this.replay(prior, input.amountPaise);
    const port = await this.gate.port();   // refuses first when payments are off or not set up: no row is created for nothing
    const now = this.clock();
    let topup: TopupRow;
    try {
      topup = await this.store.unit(vendorId, (tx) => tx.insertTopup({ vendorId, amountPaise: input.amountPaise, currency: 'INR', idempotencyKey: key, expiresAt: new Date(now.getTime() + b.orderExpiryMinutes * 60_000), createdByType: actor.type, createdById: actor.id }));
    } catch (e) {
      if (e instanceof DuplicateTopupError) { const again = await this.store.findTopupByIdempotency(vendorId, key); if (again) return this.replay(again, input.amountPaise); }
      throw e;
    }
    try {
      const po = await port.createOrder({ amountPaise: topup.amountPaise, currency: topup.currency, receipt: topup.id });
      await this.store.unit(vendorId, (tx) => tx.updateTopupCas(topup.id, ['CREATED'], { status: 'PENDING', providerOrderId: po.id }));
    } catch {
      await this.store.unit(vendorId, (tx) => tx.updateTopupCas(topup.id, ['CREATED'], { status: 'FAILED' }));
      throw new ConflictException(billingError('PAYMENT_PROVIDER_ERROR', 'The payment service could not start this. Please try again.'));
    }
    return topupView((await this.store.getTopupForVendor(vendorId, topup.id))!, port.publicKeyId());
  }

  private async replay(prior: TopupRow, amountPaise: number) {
    if (prior.amountPaise !== amountPaise) throw new ConflictException(walletError('WALLET_IDEMPOTENCY_CONFLICT', 'That request key was already used for a different top-up.'));
    let keyId: string | null = null;
    try { keyId = (await this.gate.port()).publicKeyId(); } catch { /* payments switched off since: the top-up is still shown */ }
    return topupView(prior, keyId);
  }

  /** The browser says "I paid"; we do not believe it. The signature is checked, then the PROVIDER is asked what that payment really is. */
  async confirmTopup(vendorId: string, topupId: string, input: { paymentId: string; signature: string }, actor: Actor) {
    const t = typeof topupId === 'string' && topupId ? await this.store.getTopupForVendor(vendorId, topupId) : null;
    if (!t) throw new NotFoundException(walletError('WALLET_TOPUP_NOT_FOUND', 'That top-up does not exist.'));
    const port = await this.gate.port();
    if (t.status === 'PAID') return topupView(t, port.publicKeyId());
    if ((t.status !== 'PENDING' && t.status !== 'EXPIRED') || !t.providerOrderId) throw new ConflictException(walletError('WALLET_TOPUP_STATE_INVALID', 'This top-up cannot be confirmed now.'));
    if (!port.verifyPaymentSignature({ orderId: t.providerOrderId, paymentId: String(input.paymentId ?? ''), signature: String(input.signature ?? '') })) throw new BadRequestException(billingError('PAYMENT_SIGNATURE_INVALID', 'The payment could not be verified.'));
    let payment;
    try { payment = await port.fetchPayment(input.paymentId); } catch { throw new ConflictException(billingError('PAYMENT_PROVIDER_ERROR', 'The payment service could not be reached. Please try again.')); }
    if (payment.orderId !== t.providerOrderId) throw new BadRequestException(billingError('PAYMENT_SIGNATURE_INVALID', 'The payment could not be verified.'));
    if (payment.status === 'authorized' || payment.status === 'created') return { ...topupView(t, port.publicKeyId()), pending: true as const };
    if (payment.status !== 'captured') throw new ConflictException(billingError('PAYMENT_NOT_CAPTURED', 'The payment was not completed.'));
    await this.settleTopup(t, { paymentId: payment.id, amount: payment.amount, currency: payment.currency }, 'CONFIRM', actor);
    return topupView((await this.store.getTopupForVendor(vendorId, t.id))!, port.publicKeyId());
  }

  /**
   * The ONE place a top-up is credited. The browser confirmation and the webhook both end here, in one unit of work: re-read the top-up, check the amount and currency against it, write the
   * TOPUP ledger entry (key "topup:<id>"), the numbered receipt and the PAID state together, or none of it. A second caller finds it PAID and changes nothing, so a double confirm, a webhook
   * replay or a confirm racing a webhook credit exactly ONCE. A payment that arrives after the order expired is still credited (the vendor paid; we hold their money).
   */
  async settleTopup(known: TopupRow, paid: { paymentId: string; amount: number; currency: string }, via: 'CONFIRM' | 'WEBHOOK', actor: Actor): Promise<SettleTopupOutcome> {
    const s = await this.settings.get(); const b = await this.billing.get();
    const outcome = await this.store.unit(known.vendorId, async (tx) => {
      const row = await tx.getTopup(known.id);
      if (!row) return 'NO_TOPUP' as const;
      if (row.status === 'PAID') return 'ALREADY_PAID' as const;
      if (row.status !== 'PENDING' && row.status !== 'EXPIRED') return 'IGNORED' as const;
      const check = verifyPaidAmount({ amountPaise: row.amountPaise, currency: row.currency }, { amount: paid.amount, currency: paid.currency });
      const wallet = await tx.wallet();
      if (check !== 'OK' || !wallet || wallet.status === 'INACTIVE') {
        await tx.audit(actor, 'wallet.topup.review', row.id, { status: row.status }, { reason: check !== 'OK' ? check : 'wallet not active', paymentId: paid.paymentId, topupPaise: row.amountPaise });
        return 'REVIEW' as const;
      }
      const now = this.clock();
      const post = await postEntry(tx, { kind: 'TOPUP', amountPaise: row.amountPaise, idempotencyKey: `topup:${row.id}`, refType: 'topup', refId: row.id, actor: { type: 'SYSTEM', id: null }, now, validityDays: s.walletCreditValidityDays, topupId: row.id });
      const fy = financialYearOf(now); const n = await tx.nextNumber('RECEIPT', fy);
      const receipt = await tx.insertReceipt({
        vendorId: row.vendorId, topupId: row.id, receiptNumber: formatInvoiceNumber(s.walletReceiptPrefix, fy, n), financialYear: fy, documentType: 'RECEIPT', issuedAt: now,
        snapshot: {
          seller: { name: b.invoiceSellerName, address: b.invoiceSellerAddress, gstin: b.invoiceSellerGstin }, topupId: row.id, amountPaise: row.amountPaise, currency: row.currency, paymentId: paid.paymentId, via,
          note: 'This is a receipt for credit added to your wallet. It is not a tax invoice.',
        },
      });
      const ok = await tx.updateTopupCas(row.id, ['PENDING', 'EXPIRED'], { status: 'PAID', paymentId: paid.paymentId, paidAmountPaise: paid.amount, paidAt: now, ledgerId: post.entry.id, receiptId: receipt.id });
      if (!ok) throw new Error('the top-up changed during settlement');   // rolls the whole unit back
      await tx.audit(actor, 'wallet.topup.paid', row.id, { status: row.status }, { status: 'PAID', amountPaise: row.amountPaise, receipt: receipt.receiptNumber, via });
      return 'CREDITED' as const;
    });
    if (outcome === 'CREDITED') this.emit('wallet.topup.credited', known.vendorId, actor, { topupId: known.id, amountPaise: known.amountPaise });
    return outcome;
  }

  /** The webhook hook (see TopupSettlementHook): a captured payment whose provider order is not a plan order. */
  async handleCapturedPayment(i: { providerOrderId: string; paymentId: string; amount: number; currency: string }): Promise<string | null> {
    const t = await this.store.findTopupByProviderOrder(i.providerOrderId);
    if (!t) return null;
    return `TOPUP_${await this.settleTopup(t, { paymentId: i.paymentId, amount: i.amount, currency: i.currency }, 'WEBHOOK', SYSTEM)}`;
  }

  // ───────────────────────────────────────────────────────────────────────────────────────── staff
  async adminList(q: { status?: string; page: number; pageSize: number }) {
    const status = q.status === 'INACTIVE' || q.status === 'ACTIVE' || q.status === 'FROZEN' ? q.status : undefined;
    const r = await this.store.adminWallets({ status, skip: (q.page - 1) * q.pageSize, take: q.pageSize });
    return {
      items: r.items.map((w) => ({ vendorId: w.vendorId, businessName: w.businessName, status: w.status, balancePaise: w.balancePaise, heldPaise: w.heldPaise, availablePaise: available(w), activatedAt: w.activatedAt, updatedAt: w.updatedAt })),
      page: q.page, pageSize: q.pageSize, total: r.total,
    };
  }
  async adminGet(vendorId: string) {
    const w = await this.store.wallet(vendorId);
    if (!w) throw new NotFoundException(walletError('WALLET_NOT_ACTIVE', 'That vendor has no wallet.'));
    const lots = await this.store.lots(vendorId);
    return {
      vendorId, status: w.status, frozenReason: w.frozenReason, balancePaise: w.balancePaise, heldPaise: w.heldPaise, availablePaise: available(w), activatedAt: w.activatedAt, activatedByEventId: w.activatedByEventId, billingProfile: { stateCode: w.billingStateCode, gstin: w.billingGstin },
      lots: lots.map((l) => ({ id: l.id, source: l.source, amountPaise: l.amountPaise, remainingPaise: l.remainingPaise, expiresAt: l.expiresAt, status: l.status })),
    };
  }
  async adminLedger(vendorId: string, page: number, pageSize: number) {
    const r = await this.store.ledgerPage(vendorId, (page - 1) * pageSize, pageSize);
    return { items: r.items.map((e) => ({ ...ledgerView(e), actorId: e.actorId, holdId: e.holdId, reversesId: e.reversesId, idempotencyKey: e.idempotencyKey })), page, pageSize, total: r.total };
  }

  /** SUPER_ADMIN: add or take away credit, with a reason. A positive adjustment opens a lot like a top-up; a negative one can never take held money. */
  async adjust(vendorId: string, input: { amountPaise: number; reason: string; idempotencyKey: string }, actor: Actor) {
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    if (reason.length < 5) throw new BadRequestException(walletError('WALLET_ADJUST_INVALID', 'A reason of at least 5 characters is required.'));
    const s = await this.settings.get(); const lim = await this.limits();
    try {
      const r = await this.store.unit(vendorId, async (tx) => {
        const p = await postEntry(tx, { kind: 'ADJUSTMENT', amountPaise: input.amountPaise, idempotencyKey: String(input.idempotencyKey ?? ''), refType: 'adjustment', refId: null, reason, actor: { type: 'STAFF', id: actor.id }, now: this.clock(), validityDays: s.walletCreditValidityDays });
        if (!p.replay) await tx.audit(actor, 'wallet.adjust', vendorId, null, { amountPaise: input.amountPaise, reason, balanceAfterPaise: p.entry.balanceAfterPaise });
        return p;
      });
      if (!r.replay) this.emit('wallet.adjusted', vendorId, actor, { amountPaise: input.amountPaise });
      return { entry: ledgerView(r.entry), replay: r.replay };
    } catch (e) { if (e instanceof WalletRuleError) throw walletHttpError(e, lim); throw e; }
  }

  /** SUPER_ADMIN: freeze or unfreeze. A frozen wallet cannot spend; top-ups already paid are still credited, and holds can still be released. */
  async setFrozen(vendorId: string, input: { frozen: boolean; reason: string }, actor: Actor) {
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    if (reason.length < 5) throw new BadRequestException(walletError('WALLET_ADJUST_INVALID', 'A reason of at least 5 characters is required.'));
    if (typeof input.frozen !== 'boolean') throw new BadRequestException(walletError('WALLET_ADJUST_INVALID', 'Say whether to freeze or unfreeze.'));
    const r = await this.store.unit(vendorId, async (tx) => {
      const w = await tx.wallet();
      if (!w || w.status === 'INACTIVE') throw notActive();
      const next = await tx.setFrozen(input.frozen, input.frozen ? reason : null);
      await tx.audit(actor, input.frozen ? 'wallet.freeze' : 'wallet.unfreeze', vendorId, { status: w.status }, { status: next.status, reason });
      return next;
    });
    this.emit(input.frozen ? 'wallet.frozen' : 'wallet.unfrozen', vendorId, actor, { reason });
    return { status: r.status };
  }

  // ───────────────────────────────────────────────────────────────────────────────────────── reconcile and expiry
  async reconcileVendor(vendorId: string) {
    const w = await this.store.wallet(vendorId);
    if (!w) throw new NotFoundException(walletError('WALLET_NOT_ACTIVE', 'That vendor has no wallet.'));
    const [ledger, lots] = await Promise.all([this.store.allLedger(vendorId), this.store.lots(vendorId)]);
    const r = reconcile({ balancePaise: w.balancePaise, heldPaise: w.heldPaise, entries: ledger, lots });
    return { vendorId, ok: r.ok, problems: r.problems, balancePaise: w.balancePaise, heldPaise: w.heldPaise, entries: ledger.length };
  }
  /** Reconciles every wallet (a page at a time) and reports only the ones that disagree. */
  async reconcileAll(maxWallets = 500) {
    const bad: Array<{ vendorId: string; problems: string[] }> = []; let scanned = 0;
    for (let skip = 0; scanned < maxWallets; skip += 100) {
      const page = await this.store.adminWallets({ skip, take: 100 });
      if (page.items.length === 0) break;
      for (const w of page.items) { if (w.status === 'INACTIVE') continue; scanned++; const r = await this.reconcileVendor(w.vendorId); if (!r.ok) bad.push({ vendorId: w.vendorId, problems: r.problems }); }
      if (skip + 100 >= page.total) break;
    }
    return { scanned, mismatches: bad.length, wallets: bad };
  }

  /** Writes off credit past its date, wallet by wallet (each its own unit of work). Safe to run any time and to run twice: a wallet with nothing left to write off is untouched. */
  async runExpiry(): Promise<{ vendors: number; entries: number; failed: number; topupsExpired: number }> {
    const now = this.clock(); let entries = 0; let failed = 0;
    const vendors = await this.store.vendorsWithExpiredLots(now, 200);
    for (const v of vendors) {
      try { const row = await this.store.unit(v, (tx) => expireWallet(tx, now)); if (row) { entries++; this.emit('wallet.expired', v, SYSTEM, { amountPaise: -row.amountPaise }); } } catch { failed++; }
    }
    return { vendors: vendors.length, entries, failed, topupsExpired: await this.store.expireStaleTopups(now) };
  }
}
